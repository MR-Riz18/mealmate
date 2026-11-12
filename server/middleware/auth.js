const jwt = require('jsonwebtoken');
const { ApiError } = require('../utils/response');
const User = require('../models/User');

async function protect(req, res, next) {
  try {
    const token = req.cookies && req.cookies.token;
    if (!token) throw ApiError.unauthorized('Not authenticated. Please log in.');
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      throw ApiError.unauthorized('Session expired. Please log in again.');
    }
    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user) throw ApiError.unauthorized('User no longer exists.');
    if (!user.isActive) throw ApiError.forbidden('Account has been disabled.');
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized('Not authenticated.'));
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden(`Requires one of: ${roles.join(', ')}`));
    }
    next();
  };
}

module.exports = { protect, authorize };
