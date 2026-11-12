/**
 * Ingredient matching — shared, pure logic (unit-tested in tests/phase2.test.js).
 *
 * A recipe ingredient counts as "have" when any ingredient the user entered
 * matches it. Matching is case-insensitive and tolerant of simple plurals
 * and of a user ingredient being a whole word inside a recipe ingredient
 * ("chicken" matches "chicken breast") and vice versa ("tomatoes" matches
 * "tomato"). This is a practical pantry match, not an exact-string match.
 *
 * Only REQUIRED ingredients count towards the missing list and the match
 * percentage. Optional ingredients are reported separately and never count
 * as missing. A recipe is a "perfect match" only when every required
 * ingredient is present.
 */

function normalizeWord(word) {
  let w = String(word).toLowerCase().replace(/[^a-z0-9]/g, '');
  // Simple plural handling: tomatoes -> tomato, eggs -> egg, berries -> berry.
  if (w.endsWith('ies') && w.length > 3) w = `${w.slice(0, -3)}y`;
  else if (w.endsWith('es') && w.length > 3) w = w.slice(0, -2);
  else if (w.endsWith('s') && w.length > 2) w = w.slice(0, -1);
  return w;
}

function normalizeIngredient(name) {
  return String(name || '').toLowerCase().trim().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).map(normalizeWord).join(' ');
}

function ingredientMatches(haveNormalized, needName) {
  const need = normalizeIngredient(needName);
  if (!need || !haveNormalized) return false;
  if (haveNormalized === need) return true;
  const haveWords = haveNormalized.split(' ');
  const needWords = need.split(' ');
  // Whole-word containment either way: "chicken" in "chicken breast",
  // "tomato" in "tomatoes" (already singularised), "olive oil" in "oil".
  return needWords.every((w) => haveWords.includes(w)) || haveWords.every((w) => needWords.includes(w));
}

function parseIngredientsParam(raw) {
  if (!raw) return [];
  const list = String(raw).split(',').map((s) => s.trim()).filter(Boolean);
  // De-duplicate by normalised name, keeping the first spelling for display.
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const key = normalizeIngredient(item);
    if (key && !seen.has(key)) { seen.add(key); out.push(item); }
  }
  return out;
}

/**
 * Match one recipe against the user's ingredients.
 * Returns { have, missing, optionalHave, optionalMissing, matchPercentage,
 *   isPerfectMatch, additionalIngredientsRequired }.
 * `have`/`missing`/`optional*` are arrays of ingredient names (as stored).
 */
function matchRecipe(recipe, haveIngredients) {
  const haveList = (haveIngredients || []).map((h) => normalizeIngredient(h)).filter(Boolean);
  const required = (recipe.ingredients || []).filter((ing) => ing.required !== false);
  const optional = (recipe.ingredients || []).filter((ing) => ing.required === false);

  const pick = (ings) => {
    const have = [];
    const missing = [];
    for (const ing of ings) {
      const found = haveList.some((h) => ingredientMatches(h, ing.name));
      (found ? have : missing).push(ing.name);
    }
    return { have, missing };
  };

  const req = pick(required);
  const opt = pick(optional);
  const matchPercentage = required.length === 0
    ? 100
    : Math.round((req.have.length / required.length) * 100);
  return {
    have: req.have,
    missing: req.missing,
    optionalHave: opt.have,
    optionalMissing: opt.missing,
    matchPercentage,
    isPerfectMatch: required.length > 0 && req.missing.length === 0,
    additionalIngredientsRequired: req.missing.length,
  };
}

module.exports = { normalizeIngredient, ingredientMatches, parseIngredientsParam, matchRecipe };
