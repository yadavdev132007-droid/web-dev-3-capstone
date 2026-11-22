const Cart = require('../models/Cart');
const Product = require('../models/Product');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { round2 } = require('../utils/helpers');

// Builds the cart response with prices ALWAYS taken from the database.
async function buildView(userId) {
  const cart = await Cart.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId, items: [] } },
    { upsert: true, new: true }
  ).populate('items.product', 'name price stock isActive seller');

  let total = 0;
  const items = cart.items.map((i) => {
    const p = i.product;
    const available = !!p && p.isActive && p.stock >= i.quantity;
    const lineTotal = p ? round2(p.price * i.quantity) : 0;
    if (p && p.isActive) total += lineTotal;
    return {
      productId: p ? p._id : null,
      name: p ? p.name : '(removed product)',
      unitPrice: p ? p.price : 0,
      quantity: i.quantity,
      lineTotal,
      inStock: p ? p.stock : 0,
      available,
    };
  });

  return {
    items,
    itemCount: items.reduce((s, i) => s + i.quantity, 0),
    total: round2(total),
    canCheckout: items.length > 0 && items.every((i) => i.available),
  };
}

exports.getCart = asyncHandler(async (req, res) => {
  res.json({ success: true, cart: await buildView(req.user.id) });
});

exports.addItem = asyncHandler(async (req, res) => {
  const { productId, quantity } = req.body;
  const product = await Product.findOne({ _id: productId, isActive: true });
  if (!product) throw new AppError('Product not found or unavailable', 404);

  const cart = await Cart.findOneAndUpdate(
    { user: req.user.id },
    { $setOnInsert: { user: req.user.id, items: [] } },
    { upsert: true, new: true }
  );

  const existing = cart.items.find((i) => i.product.toString() === productId);
  const newQty = (existing ? existing.quantity : 0) + quantity;
  if (newQty > product.stock) {
    throw new AppError(`Only ${product.stock} unit(s) of "${product.name}" available`, 409);
  }

  if (existing) existing.quantity = newQty;
  else cart.items.push({ product: productId, quantity });
  await cart.save();

  res.status(201).json({ success: true, cart: await buildView(req.user.id) });
});

exports.updateItem = asyncHandler(async (req, res) => {
  const { quantity } = req.body;
  const product = await Product.findOne({ _id: req.params.productId, isActive: true });
  if (!product) throw new AppError('Product not found or unavailable', 404);
  if (quantity > product.stock) throw new AppError(`Only ${product.stock} unit(s) available`, 409);

  const cart = await Cart.findOne({ user: req.user.id });
  const item = cart && cart.items.find((i) => i.product.toString() === req.params.productId);
  if (!item) throw new AppError('Item not in cart', 404);

  item.quantity = quantity;
  await cart.save();
  res.json({ success: true, cart: await buildView(req.user.id) });
});

exports.removeItem = asyncHandler(async (req, res) => {
  await Cart.updateOne({ user: req.user.id }, { $pull: { items: { product: req.params.productId } } });
  res.json({ success: true, cart: await buildView(req.user.id) });
});

exports.clearCart = asyncHandler(async (req, res) => {
  await Cart.updateOne({ user: req.user.id }, { $set: { items: [] } });
  res.json({ success: true, cart: await buildView(req.user.id) });
});
