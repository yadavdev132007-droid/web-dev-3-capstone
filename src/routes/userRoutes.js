const router = require('express').Router();
const c = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const s = require('../validators/schemas');

router.use(protect, authorize('admin'));

router.get('/', c.listUsers);
router.get('/:id', c.getUser);
router.patch('/:id', validate(s.userUpdate), c.updateUser);
router.delete('/:id', c.deleteUser);

module.exports = router;
