const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const {
  signAccessToken, signRefreshToken, verifyRefreshToken, hashToken,
} = require('../utils/tokens');

async function issueTokens(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  user.refreshTokenHash = hashToken(refreshToken);
  await user.save({ validateBeforeSave: false });
  return { accessToken, refreshToken };
}

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  if (await User.findOne({ email })) throw new AppError('Email already registered', 409);
  const user = await User.create({ name, email, password, role });
  const tokens = await issueTokens(user);
  res.status(201).json({ success: true, user, ...tokens });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password +refreshTokenHash');
  if (!user || !(await user.comparePassword(password))) throw new AppError('Invalid email or password', 401);
  if (!user.isActive) throw new AppError('Account is deactivated', 403);
  const tokens = await issueTokens(user);
  res.json({ success: true, user, ...tokens });
});

// Refresh-token rotation: each refresh invalidates the previous refresh token.
exports.refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const payload = verifyRefreshToken(refreshToken);
  const user = await User.findById(payload.id).select('+refreshTokenHash');
  if (!user || !user.isActive || user.refreshTokenHash !== hashToken(refreshToken)) {
    throw new AppError('Invalid refresh token', 401);
  }
  const tokens = await issueTokens(user);
  res.json({ success: true, ...tokens });
});

exports.logout = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user.id }, { $unset: { refreshTokenHash: 1 } });
  res.json({ success: true, message: 'Logged out' });
});

exports.me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json({ success: true, user });
});
