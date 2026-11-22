const router = require('express').Router();
const c = require('../controllers/productController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const s = require('../validators/schemas');

// Public
router.get('/', c.listProducts);

// Seller/Admin (these static paths must be declared before "/:id")
router.get('/mine', protect, authorize('seller', 'admin'), c.myProducts);
router.get('/low-stock', protect, authorize('seller', 'admin'), c.lowStock);
router.post('/', protect, authorize('seller', 'admin'), validate(s.productCreate), c.createProduct);

router.get('/:id', c.getProduct);
router.patch('/:id', protect, authorize('seller', 'admin'), validate(s.productUpdate), c.updateProduct);
router.patch('/:id/stock', protect, authorize('seller', 'admin'), validate(s.stockUpdate), c.updateStock);
router.delete('/:id', protect, authorize('seller', 'admin'), c.deleteProduct);

module.exports = router;
