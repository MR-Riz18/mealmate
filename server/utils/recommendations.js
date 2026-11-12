/**
 * Transparent rule-based recommendations — Phase 4. No machine learning:
 * every score is a sum of documented, explainable boosts, and every
 * recommendation carries a `reasons` array the UI shows verbatim.
 *
 * SCORING (all weights documented in the README):
 *   +20  recipe has a dietary tag matching one of the user's preferences
 *   +8   per required ingredient the user already has in their pantry
 *        (capped at +40, i.e. 5 ingredients; optional ingredients never count)
 *   +15  recipe cuisine is one of the user's preferred cuisines
 *   +15  recipe shares a cuisine with a recipe the user saved
 *   +10  recipe shares a dietary tag with a recipe the user saved
 *   +10  total time is 30 minutes or less
 *   -25  recipe is already planned for the current week (demoted, not excluded)
 *
 * In "expiring" mode (pantry page suggestions) the pantry set is restricted
 * to expired + expiring-soon items, each such ingredient is worth +12
 * (capped at +60), and results sort by expiring-ingredient matches first,
 * then by score. This surfaces recipes that use the food that will go
 * off soonest.
 *
 * HARD EXCLUSIONS (never recommended, regardless of score):
 *   - vegetarian preference: any ingredient matching a meat/fish keyword
 *     (chicken, beef, lamb, pork, mince, sausage, bacon, fish, salmon,
 *     tuna, prawn, shrimp, turkey, duck, ham, anchovy, gelatin, meat)
 *   - vegan preference: the meat/fish list above PLUS dairy/egg/honey
 *     keywords (milk, cheese, butter, yogurt, cream, egg, honey, ghee,
 *     mozzarella, feta, cheddar, parmesan, sour cream)
 *   - allergy: a recipe allergen matching one of the user's allergies
 *     (case-insensitive, exact after trimming)
 * Other preferences (gluten-free, dairy-free, high-protein, halal-friendly)
 * are boosts only, never hard exclusions: the ingredient data cannot
 * reliably prove a sauce or stock is gluten-free, so excluding on them
 * would be a false guarantee. Dietary tags remain filters, not certified
 * guarantees — see the README disclaimer.
 */

const { normalizeIngredient, ingredientMatches } = require('./ingredientMatch');

const MEAT_FISH_KEYWORDS = [
  'chicken', 'beef', 'lamb', 'pork', 'mince', 'sausage', 'bacon', 'fish',
  'salmon', 'tuna', 'prawn', 'shrimp', 'turkey', 'duck', 'ham', 'anchovy',
  'gelatin', 'meat', 'oyster',
];
const DAIRY_EGG_KEYWORDS = [
  'milk', 'cheese', 'butter', 'yogurt', 'yoghurt', 'cream', 'egg', 'honey',
  'ghee', 'mozzarella', 'feta', 'cheddar', 'parmesan', 'sour cream', 'whey',
];

function ingredientHasKeyword(ingredientName, keywords) {
  const normalized = normalizeIngredient(ingredientName);
  if (!normalized) return false;
  const words = new Set(normalized.split(' '));
  return keywords.some((kw) => {
    const kwWords = normalizeIngredient(kw).split(' ');
    return kwWords.every((w) => words.has(w));
  });
}

function recipeConflictsWithPreferences(recipe, user) {
  const prefs = user.dietaryPreferences || [];
  const ingredients = recipe.ingredients || [];
  if (prefs.includes('vegetarian') || prefs.includes('vegan')) {
    if (ingredients.some((ing) => ingredientHasKeyword(ing.name, MEAT_FISH_KEYWORDS))) return true;
  }
  if (prefs.includes('vegan')) {
    if (ingredients.some((ing) => ingredientHasKeyword(ing.name, DAIRY_EGG_KEYWORDS))) return true;
  }
  const allergies = (user.allergies || []).map((a) => String(a).trim().toLowerCase()).filter(Boolean);
  if (allergies.length) {
    const allergens = (recipe.allergens || []).map((a) => String(a).trim().toLowerCase());
    if (allergens.some((a) => allergies.includes(a))) return true;
  }
  return false;
}

/**
 * Score one recipe. `pantry` is an array of { name, weight } where weight
 * is the per-ingredient boost (8 normally, 12 in expiring mode).
 * Returns { score, reasons, pantryMatches, plannedThisWeek }.
 */
function scoreRecipe(recipe, ctx) {
  const { user, pantry, favoriteRecipes, plannedRecipeIds } = ctx;
  let score = 0;
  const reasons = [];

  const prefs = user.dietaryPreferences || [];
  const matchedPrefs = (recipe.dietaryTags || []).filter((t) => prefs.includes(t));
  if (matchedPrefs.length) {
    score += 20;
    reasons.push(`Matches your ${matchedPrefs.join(', ')} preference${matchedPrefs.length > 1 ? 's' : ''}`);
  }

  const required = (recipe.ingredients || []).filter((ing) => ing.required !== false);
  let pantryMatches = 0;
  for (const ing of required) {
    const hit = pantry.find((p) => ingredientMatches(p.normalized, ing.name));
    if (hit) pantryMatches += 1;
  }
  if (pantryMatches > 0) {
    const perIngredient = ctx.pantryBoost || 8;
    const cap = ctx.expiringMode ? 60 : 40;
    score += Math.min(pantryMatches * perIngredient, cap);
    if (ctx.expiringMode) {
      reasons.push(`Uses ${pantryMatches} ingredient${pantryMatches > 1 ? 's' : ''} expiring soon`);
    } else {
      reasons.push(`Uses ${pantryMatches} ingredient${pantryMatches > 1 ? 's' : ''} you already have`);
    }
  }

  if ((user.preferredCuisines || []).includes(recipe.cuisine)) {
    score += 15;
    reasons.push(`In a cuisine you prefer (${recipe.cuisine})`);
  }

  const favCuisines = new Set((favoriteRecipes || []).map((f) => f.cuisine).filter(Boolean));
  const favTags = new Set((favoriteRecipes || []).flatMap((f) => f.dietaryTags || []));
  if (recipe.cuisine && favCuisines.has(recipe.cuisine)) {
    score += 15;
    reasons.push('Similar to recipes you saved');
  } else if ((recipe.dietaryTags || []).some((t) => favTags.has(t))) {
    score += 10;
    reasons.push('Similar to recipes you saved');
  }

  const totalTime = (recipe.preparationTime || 0) + (recipe.cookingTime || 0);
  if (totalTime <= 30) {
    score += 10;
    reasons.push('Ready in 30 minutes or less');
  }

  const plannedThisWeek = plannedRecipeIds.has(String(recipe._id));
  if (plannedThisWeek) score -= 25;

  return { score, reasons, pantryMatches, plannedThisWeek };
}

/**
 * Score + sort all recipes for a user. Options: { limit, expiringMode }.
 * Excluded recipes never appear. Ties break by total time, then title.
 */
function recommendRecipes(recipes, ctx) {
  const { limit = 12, expiringMode = false } = ctx;
  const scored = [];
  for (const recipe of recipes) {
    if (recipeConflictsWithPreferences(recipe, ctx.user)) continue;
    const { score, reasons, pantryMatches, plannedThisWeek } = scoreRecipe(recipe, ctx);
    scored.push({ recipe, score, reasons, pantryMatches, plannedThisWeek });
  }
  scored.sort((a, b) => {
    if (expiringMode && b.pantryMatches !== a.pantryMatches) return b.pantryMatches - a.pantryMatches;
    if (b.score !== a.score) return b.score - a.score;
    const ta = (a.recipe.preparationTime || 0) + (a.recipe.cookingTime || 0);
    const tb = (b.recipe.preparationTime || 0) + (b.recipe.cookingTime || 0);
    if (ta !== tb) return ta - tb;
    return String(a.recipe.title).localeCompare(String(b.recipe.title));
  });
  return scored.slice(0, Math.max(1, Math.min(50, limit)));
}

module.exports = {
  MEAT_FISH_KEYWORDS,
  DAIRY_EGG_KEYWORDS,
  ingredientHasKeyword,
  recipeConflictsWithPreferences,
  scoreRecipe,
  recommendRecipes,
};
