const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');
const Recipe = require('../models/Recipe');
const Favorite = require('../models/Favorite');
const PantryItem = require('../models/PantryItem');
const MealPlan = require('../models/MealPlan');
const User = require('../models/User');
const { normalizeIngredient } = require('../utils/ingredientMatch');
const { classifyExpiry } = require('../utils/expiry');
const { currentMonday } = require('../utils/week');
const { recommendRecipes } = require('../utils/recommendations');

/**
 * GET /api/recipes/recommendations?limit=&mode=
 * Local seeded recipes only. mode=default (all pantry items) or
 * mode=expiring (expired + expiring-soon pantry items only, scored to
 * surface recipes using the food that will go off soonest).
 * Each recipe carries `score` and a plain-language `reasons` array.
 */
const listRecommendations = asyncHandler(async (req, res) => {
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
  const expiringMode = req.query.mode === 'expiring';

  const user = await User.findById(req.user._id);
  const [recipes, favorites, pantryItems, currentPlan] = await Promise.all([
    Recipe.find({}),
    Favorite.find({ user: req.user._id }).populate('recipe'),
    PantryItem.find({ user: req.user._id }),
    MealPlan.findOne({ user: req.user._id, weekStartDate: currentMonday() }),
  ]);

  const favoriteRecipes = favorites.map((f) => f.recipe).filter(Boolean);
  const plannedRecipeIds = new Set(
    (currentPlan ? currentPlan.meals : []).map((m) => String(m.recipe))
  );

  let pantry = pantryItems;
  if (expiringMode) {
    pantry = pantryItems.filter((item) => {
      const status = classifyExpiry(item.expirationDate);
      return status === 'expired' || status === 'expiring-soon';
    });
  }

  const pantryForScoring = pantry.map((item) => ({
    name: item.name,
    normalized: normalizeIngredient(item.name),
  }));

  const scored = recommendRecipes(recipes, {
    user,
    pantry: pantryForScoring,
    favoriteRecipes,
    plannedRecipeIds,
    limit,
    expiringMode,
    pantryBoost: expiringMode ? 12 : 8,
  });

  sendSuccess(res, {
    mode: expiringMode ? 'expiring' : 'default',
    recipes: scored.map(({ recipe, score, reasons, pantryMatches, plannedThisWeek }) => ({
      ...recipe.toObject({ virtuals: true }),
      score,
      reasons,
      pantryMatches,
      plannedThisWeek,
    })),
    total: scored.length,
  }, 'Recommendations retrieved');
});

module.exports = { listRecommendations };
