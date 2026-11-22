const { z } = require('zod');
const { PAYMENT_METHODS, ORDER_STATUS } = require('../config/constants');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

exports.register = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(72),
  role: z.enum(['customer', 'seller']).default('customer'), // admins cannot self-register
});

exports.login = z.object({ email: z.string().email(), password: z.string().min(1) });
exports.refresh = z.object({ refreshToken: z.string().min(10) });

exports.category = z.object({
  name: z.string().min(2).max(60),
  description: z.string().max(300).optional(),
  isActive: z.boolean().optional(),
});
exports.categoryUpdate = exports.category.partial();

const productBase = z.object({
  name: z.string().min(2).max(150),
  description: z.string().max(2000).optional(),
  price: z.number().nonnegative(),
  category: objectId,
  stock: z.number().int().nonnegative(),
  lowStockThreshold: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
  seller: objectId.optional(), // only honoured when an admin creates the product
});
exports.productCreate = productBase;
exports.productUpdate = productBase.omit({ seller: true }).partial();

exports.stockUpdate = z
  .object({ stock: z.number().int().nonnegative().optional(), adjust: z.number().int().optional() })
  .refine((v) => (v.stock === undefined) !== (v.adjust === undefined), 'Provide exactly one of "stock" or "adjust"');

exports.cartAdd = z.object({ productId: objectId, quantity: z.number().int().min(1).max(100).default(1) });
exports.cartUpdate = z.object({ quantity: z.number().int().min(1).max(100) });

exports.checkout = z.object({
  shippingAddress: z.object({
    fullName: z.string().min(2),
    phone: z.string().min(7).max(20),
    line1: z.string().min(3),
    line2: z.string().optional(),
    city: z.string().min(2),
    state: z.string().optional(),
    postalCode: z.string().min(3).max(12),
    country: z.string().default('India'),
  }),
  paymentMethod: z.enum(PAYMENT_METHODS).default('SIMULATED_CARD'),
});

exports.orderStatus = z.object({
  status: z.enum(Object.values(ORDER_STATUS)),
  note: z.string().max(300).optional(),
});

exports.userUpdate = z.object({
  isActive: z.boolean().optional(),
  role: z.enum(['customer', 'seller', 'admin']).optional(),
});
