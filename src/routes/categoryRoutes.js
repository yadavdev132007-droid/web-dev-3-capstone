const router = require('express').Router();
const c = require('../controllers/categoryController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const s = require('../validators/schemas');

router.get('/', c.listCategories); // public

router.use(protect, authorize('admin'));
router.post('/', validate(s.category), c.createCategory);
router.patch('/:id', validate(s.categoryUpdate), c.updateCategory);
router.delete('/:id', c.deleteCategory);

module.exports = router;
