/**
 * Pantry expiry classification — Phase 4.
 *
 * Threshold (documented in the README): an item expires "soon" when its
 * expiration date is today or within the next 7 days. Dates are compared
 * as calendar days (UTC), not instants, so an item expiring today counts
 * as expiring soon, not expired.
 *
 * These labels are INFORMATIONAL ONLY. An item can be unsafe before its
 * date, and a date that has not passed does not make food safe. The UI
 * must carry that wording wherever these labels are shown.
 */

const EXPIRING_SOON_DAYS = 7;

function startOfDayUTC(date) {
  const d = date instanceof Date ? date : new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Whole days from today (UTC) to the given date. Negative = already past. */
function daysUntil(date, now = new Date()) {
  if (date == null) return null;
  const target = startOfDayUTC(date);
  const today = startOfDayUTC(now);
  return Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Returns 'none' (no date), 'expired', 'expiring-soon', or 'fresh'.
 * `now` is injectable so tests can pin "today".
 */
function classifyExpiry(expirationDate, now = new Date()) {
  if (expirationDate == null) return 'none';
  const days = daysUntil(expirationDate, now);
  if (days == null) return 'none';
  if (days < 0) return 'expired';
  if (days <= EXPIRING_SOON_DAYS) return 'expiring-soon';
  return 'fresh';
}

module.exports = { EXPIRING_SOON_DAYS, daysUntil, classifyExpiry };
