/**
 * Week handling for meal plans — Phase 3.
 *
 * RULE (documented in the README): a meal plan's week always starts on
 * Monday. Any date supplied by the client is normalised to the Monday of
 * its week (UTC midnight), so "this week" means the same week for every
 * client regardless of timezone quirks. Days are numbered 0–6, where
 * 0 = Monday and 6 = Sunday.
 */

function toMonday(input) {
  const d = input instanceof Date ? new Date(input) : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  // Use UTC fields so the Monday is stable across server timezones.
  const day = d.getUTCDay(); // 0 = Sunday … 6 = Saturday
  const shift = (day + 6) % 7; // days since Monday
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - shift));
  return monday;
}

function currentMonday() {
  return toMonday(new Date());
}

function formatDateYYYYMMDD(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** The 7 calendar dates (Mon–Sun) of the week starting on `monday`. */
function weekDates(monday) {
  const out = [];
  for (let i = 0; i < 7; i++) {
    out.push(new Date(monday.getTime() + i * 24 * 60 * 60 * 1000));
  }
  return out;
}

function addWeeks(monday, n) {
  return new Date(monday.getTime() + n * 7 * 24 * 60 * 60 * 1000);
}

module.exports = { toMonday, currentMonday, formatDateYYYYMMDD, weekDates, addWeeks };
