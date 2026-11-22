const mongoose = require('mongoose');
const { ORDER_STATUS, PAYMENT_METHODS, PAYMENT_STATUS } = require('../config/constants');

const orderItemSchema = new mongoose.Schema({
  _id: false,
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },   // snapshot
  price: { type: Number, required: true },  // snapshot (unit price at purchase time)
  quantity: { type: Number, required: true, min: 1 },
});

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true, required: true },
    checkoutId: { type: String, index: true }, // groups the per-seller orders from one checkout
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: { type: [orderItemSchema], validate: (v) => v.length > 0 },
    subtotal: { type: Number, required: true },
    total: { type: Number, required: true },
    shippingAddress: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      line1: { type: String, required: true },
      line2: String,
      city: { type: String, required: true },
      state: String,
      postalCode: { type: String, required: true },
      country: { type: String, required: true, default: 'India' },
    },
    payment: {
      method: { type: String, enum: PAYMENT_METHODS, required: true },
      status: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.PENDING },
      simulated: { type: Boolean, default: true }, // always true: no real gateway
      paidAt: Date,
    },
    status: { type: String, enum: Object.values(ORDER_STATUS), default: ORDER_STATUS.PENDING, index: true },
    statusHistory: [
      {
        _id: false,
        status: String,
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        note: String,
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
