// Centralized error handler — always returns the consistent response shape.
// Server (5xx) errors are also recorded into the Phase 5 in-memory error
// log (no bodies, headers, cookies or secrets — message only) so the
// admin logs endpoint can show them.
const { recordServerError } = require('../utils/errorLog');

function errorHandler(err, req, res, next) {
  recordServerError(err, req);
  if (err && err.name === 'ValidationError') {
    const messages = Object.values(err.errors || {}).map((e) => e.message);
    return res.status(400).json({ success: false, message: 'Validation failed', errors: messages });
  }
  if (err && err.code === 11000) {
    return res.status(409).json({ success: false, message: 'Duplicate entry.' });
  }
  const status = err && err.status ? err.status : 500;
  const message = err && err.message ? err.message : 'Server error.';
  const body = { success: false, message };
  if (err && err.errors) body.errors = err.errors;
  return res.status(status).json(body);
}
module.exports = { errorHandler };
