const Product = require('../models/Product');
const Category = require('../models/Category');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { parsePagination, paginated } = require('../utils/helpers');
const { checkLowStock } = require('../services/orderService');
const { ROLES } = require('../config/constants');

const SORTS = { price: 'price', '-price': '-price', name: 'name', '-name': '-name', newest: '-createdAt', oldest: 'createdAt' };

// PUBLIC: search, filter, sort, paginate
exports.listProducts = asyncHandler(async (req, res) => {
  const pg = parsePagination(req.query);
  const { q, category, seller, minPrice, maxPrice, inStock, sort } = req.query;

  const filter = { isActive: true };
  if (q) filter.$text = { $search: q };
  if (category) filter.category = category;
  if (seller) filter.seller = seller;
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }
  if (inStock === 'true') filter.stock = { $gt: 0 };

  const sortBy = SORTS[sort] || '-createdAt';
  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'name slug')
      .populate('seller', 'name')
      .sort(sortBy)
      .skip(pg.skip)
      .limit(pg.limit),
    Product.countDocuments(filter),
  ]);
  res.json({ success: true, ...paginated(products, total, pg) });
});

exports.getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, isActive: true })
    .populate('category', 'name slug')
    .populate('seller', 'name');
  if (!product) throw new AppError('Product not found', 404);
  res.json({ success: true, product });
});

// SELLER/ADMIN: own products (admin sees all) including inactive
exports.myProducts = asyncHandler(async (req, res) => {
  const pg = parsePagination(req.query);
  const filter = req.user.role === ROLES.ADMIN ? {} : { seller: req.user.id };
  const [products, total] = await Promise.all([
    Product.find(filter).populate('category', 'name').sort('-createdAt').skip(pg.skip).limit(pg.limit),
    Product.countDocuments(filter),
  ]);
  res.json({ success: true, ...paginated(products, total, pg) });
});

exports.lowStock = asyncHandler(async (req, res) => {
  const match = { isActive: true, $expr: { $lte: ['$stock', '$lowStockThreshold'] } };
  if (req.user.role === ROLES.SELLER) match.seller = req.user.id;
  const products = await Product.find(match).populate('seller', 'name').sort('stock');
  res.json({ success: true, count: products.length, products });
});

exports.createProduct = asyncHandler(async (req, res) => {
  const data = { ...req.body };
  const category = await Category.findOne({ _id: data.category, isActive: true });
  if (!category) throw new AppError('Category not found or inactive', 400);

  if (req.user.role === ROLES.SELLER) {
    data.seller = req.user.id; // sellers can only create for themselves
  } else if (data.seller) {
    const s = await User.findOne({ _id: data.seller, role: ROLES.SELLER, isActive: true });
    if (!s) throw new AppError('Specified seller does not exist', 400);
  } else {
    data.seller = req.user.id; // platform product owned by the admin
  }

  const product = await Product.create(data);
  checkLowStock(product);
  res.status(201).json({ success: true, product });
});

// Ownership rule: seller may only touch own products; admin may touch any.
async function loadOwned(req) {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError('Product not found', 404);
  if (req.user.role === ROLES.SELLER && product.seller.toString() !== req.user.id) {
    throw new AppError('You can only modify your own products', 403);
  }
  return product;
}

exports.updateProduct = asyncHandler(async (req, res) => {
  const product = await loadOwned(req);
  if (req.body.category) {
    const c = await Category.findOne({ _id: req.body.category, isActive: true });
    if (!c) throw new AppError('Category not found or inactive', 400);
  }
  Object.assign(product, req.body);
  await product.save();
  checkLowStock(product);
  res.json({ success: true, product });
});

// Atomic stock edit: absolute { stock } or relative { adjust }
exports.updateStock = asyncHandler(async (req, res) => {
  const product = await loadOwned(req);
  const { stock, adjust } = req.body;

  let updated;
  if (stock !== undefined) {
    updated = await Product.findByIdAndUpdate(product._id, { $set: { stock } }, { new: true });
  } else {
    // negative adjust only succeeds if enough stock remains -> never below zero
    updated = await Product.findOneAndUpdate(
      { _id: product._id, stock: { $gte: adjust < 0 ? -adjust : 0 } },
      { $inc: { stock: adjust } },
      { new: true }
    );
    if (!updated) throw new AppError('Adjustment would make stock negative', 400);
  }
  checkLowStock(updated);
  res.json({ success: true, product: updated });
});

// Soft delete so old orders keep a valid product reference
exports.deleteProduct = asyncHandler(async (req, res) => {
  const product = await loadOwned(req);
  product.isActive = false;
  await product.save();
  res.json({ success: true, message: 'Product deactivated' });
});
