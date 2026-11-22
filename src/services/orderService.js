const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Order = require('../models/Order');
const eventBus = require('../events/eventBus');
const AppError = require('../utils/AppError');
const { round2, generateOrderNumber } = require('../utils/helpers');
const { ORDER_STATUS, ORDER_TRANSITIONS, PAYMENT_STATUS, ROLES } = require('../config/constants');

/**
 * Emit 'stock-low' when a product crosses its low-stock threshold.
 */
function checkLowStock(product) {
  if (product.stock <= product.lowStockThreshold) {
    eventBus.emit('stock-low', {
      productId: product._id,
      name: product.name,
      stock: product.stock,
      threshold: product.lowStockThreshold,
      sellerId: product.seller,
    });
  }
}

async function releaseStock(reserved) {
  await Promise.all(
    reserved.map((r) => Product.updateOne({ _id: r.product }, { $inc: { stock: r.quantity } }))
  );
}

/**
 * CHECKOUT
 * 1. Load cart (only product ids + quantities are trusted from our own DB).
 * 2. For each item run ONE atomic conditional update:
 *      findOneAndUpdate({ _id, isActive: true, stock: { $gte: qty } }, { $inc: { stock: -qty } })
 *    MongoDB applies this atomically per document, so two concurrent buyers can never push
 *    stock below zero. If it returns null, the item is out of stock.
 * 3. If any item fails, previously reserved stock is released (compensation) -> all-or-nothing.
 * 4. The returned (post-update) product document supplies the server-side price snapshot.
 * 5. Items are grouped by seller -> one order per seller.
 * Works on standalone MongoDB (no replica set needed).
 */
exports.placeOrder = async (customerId, { shippingAddress, paymentMethod }) => {
  const cart = await Cart.findOne({ user: customerId });
  if (!cart || cart.items.length === 0) throw new AppError('Your cart is empty', 400);

  const reserved = []; // { product, quantity, doc }
  const createdOrders = [];

  try {
    for (const item of cart.items) {
      const updated = await Product.findOneAndUpdate(
        { _id: item.product, isActive: true, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { new: true }
      );
      if (!updated) {
        const p = await Product.findById(item.product).select('name stock isActive');
        const msg =
          p && p.isActive
            ? `Insufficient stock for "${p.name}" (requested ${item.quantity}, available ${p.stock})`
            : 'A product in your cart is no longer available';
        throw new AppError(msg, 409);
      }
      reserved.push({ product: updated._id, quantity: item.quantity, doc: updated });
    }

    // group by seller
    const bySeller = new Map();
    for (const r of reserved) {
      const key = r.doc.seller.toString();
      if (!bySeller.has(key)) bySeller.set(key, []);
      bySeller.get(key).push(r);
    }

    const checkoutId = new mongoose.Types.ObjectId().toString();
    const isPaidNow = paymentMethod === 'SIMULATED_CARD';

    for (const [sellerId, list] of bySeller) {
      const items = list.map((r) => ({
        product: r.doc._id,
        name: r.doc.name,
        price: r.doc.price,
        quantity: r.quantity,
      }));
      const subtotal = round2(items.reduce((sum, i) => sum + i.price * i.quantity, 0));

      const order = await Order.create({
        orderNumber: generateOrderNumber(),
        checkoutId,
        customer: customerId,
        seller: sellerId,
        items,
        subtotal,
        total: subtotal,
        shippingAddress,
        payment: {
          method: paymentMethod,
          simulated: true,
          status: isPaidNow ? PAYMENT_STATUS.PAID_SIMULATED : PAYMENT_STATUS.PENDING,
          paidAt: isPaidNow ? new Date() : undefined,
        },
        status: ORDER_STATUS.PENDING,
        statusHistory: [{ status: ORDER_STATUS.PENDING, changedBy: customerId, note: 'Order placed' }],
      });
      createdOrders.push(order);
    }
  } catch (err) {
    // compensate: delete any partially created orders and give stock back
    if (createdOrders.length) await Order.deleteMany({ _id: { $in: createdOrders.map((o) => o._id) } });
    await releaseStock(reserved);
    throw err;
  }

  await Cart.updateOne({ user: customerId }, { $set: { items: [] } });

  createdOrders.forEach((order) => eventBus.emit('order-placed', { order }));
  reserved.forEach((r) => checkLowStock(r.doc));

  return createdOrders;
};

/**
 * ORDER STATUS CHANGE (including cancellation)
 * - Enforces role permissions and the transition table.
 * - The update filter includes the current status, so two concurrent requests cannot both
 *   apply a transition (important: stock is restored exactly once on cancellation).
 */
exports.changeStatus = async (orderId, actor, newStatus, note) => {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Order not found', 404);

  // --- permission checks ---
  if (actor.role === ROLES.CUSTOMER) {
    if (order.customer.toString() !== actor.id) throw new AppError('Order not found', 404);
    if (newStatus !== ORDER_STATUS.CANCELLED) throw new AppError('Customers can only cancel orders', 403);
  } else if (actor.role === ROLES.SELLER) {
    if (order.seller.toString() !== actor.id) throw new AppError('You can only update your own orders', 403);
  } // admin: allowed for any order

  // --- state machine ---
  const allowed = ORDER_TRANSITIONS[order.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new AppError(
      `Invalid status transition: ${order.status} -> ${newStatus}. Allowed: ${allowed.join(', ') || 'none'}`,
      400
    );
  }

  const set = { status: newStatus };
  if (newStatus === ORDER_STATUS.CANCELLED && order.payment.status === PAYMENT_STATUS.PAID_SIMULATED) {
    set['payment.status'] = PAYMENT_STATUS.REFUNDED_SIMULATED;
  }
  if (newStatus === ORDER_STATUS.DELIVERED && order.payment.status === PAYMENT_STATUS.PENDING) {
    set['payment.status'] = PAYMENT_STATUS.PAID_SIMULATED; // simulated cash-on-delivery collected
    set['payment.paidAt'] = new Date();
  }

  const updated = await Order.findOneAndUpdate(
    { _id: orderId, status: order.status },
    {
      $set: set,
      $push: { statusHistory: { status: newStatus, changedBy: actor.id, note } },
    },
    { new: true }
  );
  if (!updated) throw new AppError('Order was modified by another request, please retry', 409);

  if (newStatus === ORDER_STATUS.CANCELLED) {
    await Promise.all(
      updated.items.map((i) => Product.updateOne({ _id: i.product }, { $inc: { stock: i.quantity } }))
    );
  }

  eventBus.emit('order-status-changed', { order: updated, previousStatus: order.status, changedBy: actor.id });
  return updated;
};

exports.checkLowStock = checkLowStock;
