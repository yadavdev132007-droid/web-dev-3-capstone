const router = require('express').Router();
const c = require('../controllers/cartController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const s = require('../validators/schemas');

router.use(protect, authorize('customer'));

router.get('/', c.getCart);
router.post('/items', validate(s.cartAdd), c.addItem);
router.patch('/items/:productId', validate(s.cartUpdate), c.updateItem);
router.delete('/items/:productId', c.removeItem);
router.delete('/', c.clearCart);

module.exports = router;
