const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { parsePagination, paginated } = require('../utils/helpers');

// ADMIN ONLY
exports.listUsers = asyncHandler(async (req, res) => {
  const pg = parsePagination(req.query);
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
  if (req.query.q) filter.$or = [
    { name: new RegExp(req.query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
    { email: new RegExp(req.query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
  ];
  const [users, total] = await Promise.all([
    User.find(filter).sort('-createdAt').skip(pg.skip).limit(pg.limit),
    User.countDocuments(filter),
  ]);
  res.json({ success: true, ...paginated(users, total, pg) });
});

exports.getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);
  res.json({ success: true, user });
});

exports.updateUser = asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id) throw new AppError('Admins cannot modify their own role/status', 400);
  const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!user) throw new AppError('User not found', 404);
  res.json({ success: true, user });
});

exports.deleteUser = asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id) throw new AppError('You cannot delete yourself', 400);
  // Soft delete keeps order history consistent
  const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!user) throw new AppError('User not found', 404);
  res.json({ success: true, message: 'User deactivated', user });
});
