const router = require('express').Router();
const c = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const s = require('../validators/schemas');

router.use(protect);

router.post('/checkout', authorize('customer'), validate(s.checkout), c.checkout);
router.get('/', c.listOrders);                       // role-scoped
router.get('/:id', c.getOrder);                      // owner / assigned seller / admin
router.patch('/:id/status', validate(s.orderStatus), c.updateStatus);
router.post('/:id/cancel', c.cancelOrder);           // customer (own), seller (own), admin

module.exports = router;
