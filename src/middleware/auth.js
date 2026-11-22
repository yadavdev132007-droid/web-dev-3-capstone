const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyAccessToken } = require('../utils/tokens');

// Verifies the Bearer access token and attaches req.user
exports.protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new AppError('Authentication required', 401);

  const payload = verifyAccessToken(token); // JWT errors handled by errorHandler
  const user = await User.findById(payload.id);
  if (!user || !user.isActive) throw new AppError('User no longer exists or is deactivated', 401);

  req.user = { id: user._id.toString(), role: user.role, name: user.name, email: user.email };
  next();
});

// RBAC: allow only the listed roles
exports.authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new AppError('You do not have permission to perform this action', 403));
  }
  next();
};
