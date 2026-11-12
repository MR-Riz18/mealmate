const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');
const User = require('../models/User');
const Recipe = require('../models/Recipe');
const Favorite = require('../models/Favorite');
const MealPlan = require('../models/MealPlan');
const ShoppingList = require('../models/ShoppingList');
const PantryItem = require('../models/PantryItem');
const RecentView = require('../models/RecentView');
const { currentMonday, formatDateYYYYMMDD } = require('../utils/week');
const { computeDaySummaries } = require('../utils/nutrition');
const { classifyExpiry, daysUntil } = require('../utils/expiry');
const { normalizeIngredient } = require('../utils/ingredientMatch');
const { recommendRecipes } = require('../utils/recommendations');

const MEAL_TYPE_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snacks: 'Snacks' };

// Weekday index matching utils/week.js: 0 = Monday … 6 = Sunday, in UTC
// (the week itself is defined in UTC midnight Mondays).
function todayIndexUTC(now = new Date()) {
  return (now.getUTCDay() + 6) % 7;
}

/**
 * GET /api/dashboard — one aggregated, user-scoped home view.
 * Everything here belongs to the logged-in user; nothing is shared
 * across users and nothing is faked. Nutrition follows the Phase 3
 * rule (per-serving nutrition × planned servings) and carries the
 * same incomplete-data flag as the planner.
 */
const getDashboard = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const monday = currentMonday();
  const user = await User.findById(userId);

  const [plan, favorites, lists, pantryItems, recentViews, recipes] = await Promise.all([
    MealPlan.findOne({ user: userId, weekStartDate: monday }).populate('meals.recipe'),
    Favorite.find({ user: userId }).populate('recipe').sort({ createdAt: -1 }).limit(6),
    ShoppingList.find({ user: userId }).sort({ updatedAt: -1 }).limit(1),
    PantryItem.find({ user: userId }),
    RecentView.find({ user: userId }).populate('recipe').sort({ viewedAt: -1 }).limit(10),
    Recipe.find({}),
  ]);

  // --- Today's meals + week overview + today's nutrition ---
  const meals = plan ? plan.meals : [];
  const recipesById = new Map();
  for (const meal of meals) {
    if (meal.recipe && meal.recipe._id) recipesById.set(String(meal.recipe._id), meal.recipe);
  }
  const daySummaries = computeDaySummaries(meals, recipesById).map((s) => ({
    ...s,
    calorieTarget: user.calorieTarget != null ? user.calorieTarget : null,
    caloriesVsTarget: user.calorieTarget != null
      ? Math.round((s.totals.calories - user.calorieTarget) * 10) / 10
      : null,
  }));
  const todayIndex = todayIndexUTC();
  const todaysMeals = meals
    .filter((m) => m.day === todayIndex)
    .map((m) => ({
      day: m.day,
      mealType: m.mealType,
      mealTypeLabel: MEAL_TYPE_LABELS[m.mealType] || m.mealType,
      servings: m.servings,
      recipe: m.recipe && m.recipe._id
        ? { _id: m.recipe._id, title: m.recipe.title, image: m.recipe.image, cuisine: m.recipe.cuisine }
        : null,
    }));
  const todaySummary = daySummaries[todayIndex];

  // --- Shopping progress (latest list by most recent update) ---
  let shoppingProgress = null;
  if (lists.length) {
    const list = lists[0];
    const total = list.items.length;
    const checked = list.items.filter((i) => i.checked).length;
    shoppingProgress = {
      listId: list._id,
      weekStartDate: list.weekStartDate ? formatDateYYYYMMDD(list.weekStartDate) : null,
      checked,
      total,
      remaining: total - checked,
    };
  }

  // --- Pantry expiring soon (existing 7-day rule) ---
  const pantryExpiring = pantryItems
    .map((item) => {
      const obj = item.toObject();
      return {
        ...obj,
        expiryStatus: classifyExpiry(obj.expirationDate),
        daysUntilExpiry: daysUntil(obj.expirationDate),
      };
    })
    .filter((i) => i.expiryStatus === 'expired' || i.expiryStatus === 'expiring-soon')
    .sort((a, b) => (a.daysUntilExpiry ?? 9999) - (b.daysUntilExpiry ?? 9999));

  // --- Favorites + recommendations (reuse Phase 4 logic) ---
  const favoriteRecipes = favorites.map((f) => f.recipe).filter(Boolean);
  const plannedRecipeIds = new Set(meals.map((m) => String(m.recipe && m.recipe._id ? m.recipe._id : m.recipe)));
  const scored = recommendRecipes(recipes, {
    user,
    pantry: pantryItems.map((item) => ({ name: item.name, normalized: normalizeIngredient(item.name) })),
    favoriteRecipes,
    plannedRecipeIds,
    limit: 6,
    expiringMode: false,
    pantryBoost: 8,
  });
  const recommendations = scored.map(({ recipe, score, reasons, pantryMatches, plannedThisWeek }) => ({
    ...recipe.toObject({ virtuals: true }),
    score,
    reasons,
    pantryMatches,
    plannedThisWeek,
  }));

  // --- Recently viewed (deleted recipes resolve gracefully: dropped) ---
  const recentlyViewed = recentViews
    .map((v) => v.recipe)
    .filter(Boolean)
    .map((r) => ({ _id: r._id, title: r.title, image: r.image, cuisine: r.cuisine }));

  sendSuccess(res, {
    user: user.toPublicJSON(),
    weekStartDate: formatDateYYYYMMDD(monday),
    todayIndex,
    todaysMeals,
    weekOverview: {
      mealCount: meals.length,
      hasPlan: Boolean(plan),
      daySummaries,
    },
    todayNutrition: {
      totals: todaySummary.totals,
      incomplete: todaySummary.incomplete,
      missingRecipes: todaySummary.missingRecipes,
      missingNutrients: todaySummary.missingNutrients,
      calorieTarget: user.calorieTarget != null ? user.calorieTarget : null,
      caloriesVsTarget: todaySummary.caloriesVsTarget,
    },
    shoppingProgress,
    pantryExpiring,
    favorites: favoriteRecipes.map((r) => ({ _id: r._id, title: r.title, image: r.image, cuisine: r.cuisine })),
    recommendations,
    recentlyViewed,
  }, 'Dashboard retrieved');
});

module.exports = { getDashboard, todayIndexUTC };
