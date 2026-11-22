const Order = require('../models/Order');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const orderService = require('../services/orderService');
const { parsePagination, paginated } = require('../utils/helpers');
const { ROLES } = require('../config/constants');

exports.checkout = asyncHandler(async (req, res) => {
  const orders = await orderService.placeOrder(req.user.id, req.body);
  res.status(201).json({
    success: true,
    message: 'Order placed. NOTE: payment is SIMULATED - no real payment was processed.',
    orders,
  });
});

// Role-scoped listing: customer -> own, seller -> assigned to them, admin -> all
exports.listOrders = asyncHandler(async (req, res) => {
  const pg = parsePagination(req.query);
  const filter = {};
  if (req.user.role === ROLES.CUSTOMER) filter.customer = req.user.id;
  else if (req.user.role === ROLES.SELLER) filter.seller = req.user.id;
  if (req.query.status) filter.status = req.query.status;
  if (req.user.role === ROLES.ADMIN) {
    if (req.query.customer) filter.customer = req.query.customer;
    if (req.query.seller) filter.seller = req.query.seller;
  }
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('customer', 'name email')
      .populate('seller', 'name')
      .sort('-createdAt')
      .skip(pg.skip)
      .limit(pg.limit),
    Order.countDocuments(filter),
  ]);
  res.json({ success: true, ...paginated(orders, total, pg) });
});

exports.getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('customer', 'name email')
    .populate('seller', 'name');
  if (!order) throw new AppError('Order not found', 404);

  const isOwner = order.customer._id.toString() === req.user.id;
  const isSeller = order.seller._id.toString() === req.user.id;
  if (req.user.role !== ROLES.ADMIN && !isOwner && !isSeller) throw new AppError('Order not found', 404);

  res.json({ success: true, order });
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const order = await orderService.changeStatus(req.params.id, req.user, req.body.status, req.body.note);
  res.json({ success: true, order });
});

exports.cancelOrder = asyncHandler(async (req, res) => {
  const order = await orderService.changeStatus(req.params.id, req.user, 'cancelled', req.body?.note || 'Cancelled');
  res.json({ success: true, message: 'Order cancelled and stock restored', order });
});
