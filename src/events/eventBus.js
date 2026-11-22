const { EventEmitter } = require('events');

// Single internal event bus. Services emit domain events; listeners (notifications, logging, ...) react.
//   'order-placed'          -> { order }
//   'order-status-changed'  -> { order, previousStatus, changedBy }
//   'stock-low'             -> { productId, name, stock, threshold, sellerId }
class EventBus extends EventEmitter {}

const eventBus = new EventBus();
eventBus.setMaxListeners(20);

module.exports = eventBus;
