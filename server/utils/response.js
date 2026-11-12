class ApiError extends Error {
  constructor(status, message, errors = null) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
  static badRequest(msg, errors = null) { return new ApiError(400, msg, errors); }
  static unauthorized(msg = 'Not authenticated.') { return new ApiError(401, msg); }
  static forbidden(msg = 'Forbidden.') { return new ApiError(403, msg); }
  static notFound(msg = 'Not found.') { return new ApiError(404, msg); }
  static conflict(msg) { return new ApiError(409, msg); }
}

function sendSuccess(res, data, message = 'OK', status = 200) {
  return res.status(status).json({ success: true, message, data });
}
function sendCreated(res, data, message = 'Created') {
  return sendSuccess(res, data, message, 201);
}

module.exports = { ApiError, sendSuccess, sendCreated };
