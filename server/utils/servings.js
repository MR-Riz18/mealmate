/**
 * Serving scaling — shared, pure logic (unit-tested in tests/phase2.test.js).
 * The client has a mirror copy at client/src/utils/servings.js with the
 * same rules; keep both in sync when changing the fraction display rule.
 *
 * Display rule: whole numbers stay whole. Otherwise, use the nearest common
 * kitchen fraction (denominators up to 8, including thirds) when it is
 * within 0.04 of the scaled value, e.g. 0.5 -> "1/2", 1.5 -> "1 1/2".
 * Anything else is rounded to at most 2 decimal places (trailing zeros cut).
 * A null/undefined quantity stays null — the UI renders it as "to taste".
 */

const FRACTIONS = [
  [1, 8], [1, 4], [1, 3], [3, 8], [1, 2], [5, 8], [2, 3], [3, 4], [7, 8],
];

function scaleQuantity(quantity, baseServings, targetServings) {
  if (quantity == null || Number.isNaN(Number(quantity))) return null;
  if (!baseServings || baseServings <= 0 || !targetServings || targetServings <= 0) return Number(quantity);
  return Number(quantity) * (Number(targetServings) / Number(baseServings));
}

function formatQuantity(value) {
  if (value == null || Number.isNaN(Number(value))) return null;
  const v = Number(value);
  if (v < 0) return String(Math.round(v * 100) / 100);
  const whole = Math.floor(v);
  const frac = v - whole;
  if (frac < 0.04) return String(whole);
  if (1 - frac < 0.04) return String(whole + 1);
  for (const [num, den] of FRACTIONS) {
    if (Math.abs(frac - num / den) < 0.04) {
      const fracText = `${num}/${den}`;
      return whole === 0 ? fracText : `${whole} ${fracText}`;
    }
  }
  return String(Math.round(v * 100) / 100);
}

function scaleIngredient(ingredient, baseServings, targetServings) {
  const scaled = scaleQuantity(ingredient.quantity, baseServings, targetServings);
  return { ...ingredient, scaledQuantity: scaled, displayQuantity: formatQuantity(scaled) };
}

module.exports = { scaleQuantity, formatQuantity, scaleIngredient };
