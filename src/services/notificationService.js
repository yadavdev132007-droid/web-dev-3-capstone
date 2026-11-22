const eventBus = require('../events/eventBus');
const { emitToUser, emitToAdmins } = require('../sockets');

// Wires internal events to real-time Socket.IO notifications.
function registerNotificationListeners() {
  eventBus.on('order-placed', ({ order }) => {
    // Seller: new order received
    emitToUser(order.seller, 'order:new', {
      orderId: order._id,
      orderNumber: order.orderNumber,
      total: order.total,
      itemCount: order.items.length,
      message: `New order ${order.orderNumber} received`,
    });
    // Customer: confirmation
    emitToUser(order.customer, 'order:status', {
      orderId: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      message: `Your order ${order.orderNumber} has been placed`,
    });
  });

  eventBus.on('order-status-changed', ({ order, previousStatus }) => {
    const payload = {
      orderId: order._id,
      orderNumber: order.orderNumber,
      previousStatus,
      status: order.status,
      message: `Order ${order.orderNumber} is now ${order.status}`,
    };
    emitToUser(order.customer, 'order:status', payload);
    emitToUser(order.seller, 'order:status', payload);
    emitToAdmins('order:status', payload);
  });

  eventBus.on('stock-low', (info) => {
    const payload = { ...info, message: `Low stock: "${info.name}" has ${info.stock} unit(s) left` };
    emitToUser(info.sellerId, 'stock:low', payload);
    emitToAdmins('stock:low', payload);
    console.log(`[stock-low] ${info.name} -> ${info.stock} (threshold ${info.threshold})`);
  });
}

module.exports = { registerNotificationListeners };
