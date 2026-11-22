const router = require('express').Router();
const c = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const s = require('../validators/schemas');

router.post('/register', validate(s.register), c.register);
router.post('/login', validate(s.login), c.login);
router.post('/refresh', validate(s.refresh), c.refresh);
router.post('/logout', protect, c.logout);
router.get('/me', protect, c.me);

module.exports = router;
