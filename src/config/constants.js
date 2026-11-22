const ROLES = Object.freeze({ CUSTOMER: 'customer', SELLER: 'seller', ADMIN: 'admin' });

const ORDER_STATUS = Object.freeze({
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
});

// Order status state machine: current status -> allowed next statuses
const ORDER_TRANSITIONS = Object.freeze({
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
});

const PAYMENT_METHODS = Object.freeze(['SIMULATED_CARD', 'SIMULATED_COD']);

const PAYMENT_STATUS = Object.freeze({
  PENDING: 'pending',
  PAID_SIMULATED: 'paid_simulated',
  REFUNDED_SIMULATED: 'refunded_simulated',
});

module.exports = { ROLES, ORDER_STATUS, ORDER_TRANSITIONS, PAYMENT_METHODS, PAYMENT_STATUS };
