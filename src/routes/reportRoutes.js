const router = require('express').Router();
const c = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('seller', 'admin'));

router.get('/sales', c.salesSummary);
router.get('/best-selling', c.bestSelling);
router.get('/sales-by-category', c.salesByCategory);
router.get('/inventory', c.inventorySummary);

module.exports = router;
