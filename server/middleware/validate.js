const { validationResult } = require('express-validator');
const { ApiError } = require('../utils/response');

function handleValidation(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const errors = result.array().map((e) => e.msg);
    return next(ApiError.badRequest('Validation failed', errors));
  }
  next();
}
module.exports = { handleValidation };
