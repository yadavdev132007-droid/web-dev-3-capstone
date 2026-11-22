const Order = require('../models/Order');
const Product = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');
const { toObjectId } = require('../utils/helpers');
const { ROLES } = require('../config/constants');

// Seller sees only own data; admin sees all (optionally filtered with ?seller=<id>)
const sellerScope = (req) => {
  if (req.user.role === ROLES.SELLER) return { seller: toObjectId(req.user.id) };
  if (req.query.seller) return { seller: toObjectId(req.query.seller) };
  return {};
};

const dateRange = (req) => {
  const range = {};
  if (req.query.from) range.$gte = new Date(req.query.from);
  if (req.query.to) {
    const to = new Date(req.query.to);
    to.setHours(23, 59, 59, 999);
    range.$lte = to;
  }
  return Object.keys(range).length ? { createdAt: range } : {};
};

/**
 * GET /api/reports/sales?from=&to=&groupBy=day|month
 * Overall totals, time series, and order counts per status ($facet = several pipelines, one pass).
 */
exports.salesSummary = asyncHandler(async (req, res) => {
  const fmt = req.query.groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d';
  const base = { ...sellerScope(req), ...dateRange(req) };
  const notCancelled = { status: { $ne: 'cancelled' } };

  const [result] = await Order.aggregate([
    { $match: base },
    {
      $facet: {
        overall: [
          { $match: notCancelled },
          {
            $group: {
              _id: null,
              orders: { $sum: 1 },
              revenue: { $sum: '$total' },
              unitsSold: { $sum: { $sum: '$items.quantity' } },
              avgOrderValue: { $avg: '$total' },
            },
          },
          { $project: { _id: 0 } },
        ],
        series: [
          { $match: notCancelled },
          {
            $group: {
              _id: { $dateToString: { format: fmt, date: '$createdAt' } },
              orders: { $sum: 1 },
              revenue: { $sum: '$total' },
            },
          },
          { $sort: { _id: 1 } },
          { $project: { _id: 0, period: '$_id', orders: 1, revenue: 1 } },
        ],
        byStatus: [
          { $group: { _id: '$status', orders: { $sum: 1 }, value: { $sum: '$total' } } },
          { $project: { _id: 0, status: '$_id', orders: 1, value: 1 } },
        ],
      },
    },
  ]);

  res.json({
    success: true,
    report: {
      overall: result.overall[0] || { orders: 0, revenue: 0, unitsSold: 0, avgOrderValue: 0 },
      series: result.series,
      byStatus: result.byStatus,
    },
  });
});

/**
 * GET /api/reports/best-selling?limit=10&from=&to=
 */
exports.bestSelling = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  const match = { ...sellerScope(req), ...dateRange(req), status: { $ne: 'cancelled' } };

  const products = await Order.aggregate([
    { $match: match },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        name: { $last: '$items.name' },
        unitsSold: { $sum: '$items.quantity' },
        revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        orders: { $sum: 1 },
      },
    },
    { $sort: { unitsSold: -1, revenue: -1 } },
    { $limit: limit },
    { $project: { _id: 0, productId: '$_id', name: 1, unitsSold: 1, revenue: 1, orders: 1 } },
  ]);

  res.json({ success: true, products });
});

/**
 * GET /api/reports/sales-by-category  (category-wise analytics)
 */
exports.salesByCategory = asyncHandler(async (req, res) => {
  const match = { ...sellerScope(req), ...dateRange(req), status: { $ne: 'cancelled' } };
  const categories = await Order.aggregate([
    { $match: match },
    { $unwind: '$items' },
    { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'prod' } },
    { $unwind: '$prod' },
    {
      $group: {
        _id: '$prod.category',
        unitsSold: { $sum: '$items.quantity' },
        revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
      },
    },
    { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'cat' } },
    { $unwind: { path: '$cat', preserveNullAndEmptyArrays: true } },
    { $project: { _id: 0, categoryId: '$_id', category: { $ifNull: ['$cat.name', 'Unknown'] }, unitsSold: 1, revenue: 1 } },
    { $sort: { revenue: -1 } },
  ]);
  res.json({ success: true, categories });
});

/**
 * GET /api/reports/inventory
 */
exports.inventorySummary = asyncHandler(async (req, res) => {
  const match = { isActive: true, ...sellerScope(req) };

  const [result] = await Product.aggregate([
    { $match: match },
    {
      $facet: {
        summary: [
          {
            $group: {
              _id: null,
              totalProducts: { $sum: 1 },
              totalUnits: { $sum: '$stock' },
              stockValue: { $sum: { $multiply: ['$price', '$stock'] } },
              outOfStock: { $sum: { $cond: [{ $eq: ['$stock', 0] }, 1, 0] } },
              lowStock: {
                $sum: { $cond: [{ $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$lowStockThreshold'] }] }, 1, 0] },
              },
            },
          },
          { $project: { _id: 0 } },
        ],
        byCategory: [
          { $group: { _id: '$category', products: { $sum: 1 }, units: { $sum: '$stock' }, value: { $sum: { $multiply: ['$price', '$stock'] } } } },
          { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'cat' } },
          { $unwind: { path: '$cat', preserveNullAndEmptyArrays: true } },
          { $project: { _id: 0, category: { $ifNull: ['$cat.name', 'Unknown'] }, products: 1, units: 1, value: 1 } },
          { $sort: { value: -1 } },
        ],
        lowStockItems: [
          { $match: { $expr: { $lte: ['$stock', '$lowStockThreshold'] } } },
          { $sort: { stock: 1 } },
          { $limit: 50 },
          { $project: { _id: 0, productId: '$_id', name: 1, stock: 1, lowStockThreshold: 1, seller: 1 } },
        ],
      },
    },
  ]);

  res.json({
    success: true,
    report: {
      summary: result.summary[0] || { totalProducts: 0, totalUnits: 0, stockValue: 0, outOfStock: 0, lowStock: 0 },
      byCategory: result.byCategory,
      lowStockItems: result.lowStockItems,
    },
  });
});
