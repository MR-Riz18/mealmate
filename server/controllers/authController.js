const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated, ApiError } = require('../utils/response');
const { setTokenCookie, clearTokenCookie } = require('../utils/cookies');
const User = require('../models/User');

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '8h',
  });
}

const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const existing = await User.findOne({ email: String(email).toLowerCase() });
  if (existing) throw ApiError.conflict('An account with this email already exists.');
  const user = new User({ name, email });
  user.password = password;
  await user.save();
  setTokenCookie(res, signToken(user));
  sendCreated(res, { user: user.toPublicJSON() }, 'Account created');
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+passwordHash');
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid email or password.');
  }
  if (!user.isActive) throw ApiError.forbidden('Account has been disabled.');
  setTokenCookie(res, signToken(user));
  sendSuccess(res, { user: user.toPublicJSON() }, 'Logged in');
});

const logout = asyncHandler(async (req, res) => {
  clearTokenCookie(res);
  sendSuccess(res, {}, 'Logged out');
});

const me = asyncHandler(async (req, res) => {
  sendSuccess(res, { user: req.user.toPublicJSON() }, 'Current user');
});

module.exports = { register, login, logout, me };
