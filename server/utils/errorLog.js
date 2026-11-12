/**
 * In-memory ring buffer of recent SERVER errors — Phase 5.
 *
 * - Capped at 50 entries; older entries drop off the front.
 * - Only 5xx errors are recorded (validation, 404 and auth failures are
 *   normal client errors, not server errors, and would flood the log).
 * - Each entry carries ONLY the timestamp, method, path, status and
 *   message. It never carries request bodies, headers, cookies, tokens
 *   or any credential — the admin logs endpoint is safe to read for
 *   that reason, and still admin-only.
 */

const MAX_ENTRIES = 50;

const buffer = [];

function recordServerError(err, req) {
  const status = err && err.status ? err.status : 500;
  if (status < 500) return;
  buffer.push({
    at: new Date().toISOString(),
    method: req ? req.method : null,
    path: req ? req.originalUrl || req.url : null,
    status,
    message: err && err.message ? String(err.message) : 'Server error.',
  });
  while (buffer.length > MAX_ENTRIES) buffer.shift();
}

function recentErrors() {
  return [...buffer].reverse(); // newest first
}

// Test helper: empty the buffer (never used in production routes).
function clearForTests() {
  buffer.length = 0;
}

module.exports = { recordServerError, recentErrors, clearForTests, MAX_ENTRIES };
