const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated, ApiError } = require('../utils/response');
const User = require('../models/User');
const Recipe = require('../models/Recipe');
const Favorite = require('../models/Favorite');
const MealPlan = require('../models/MealPlan');
const ShoppingList = require('../models/ShoppingList');
const PantryItem = require('../models/PantryItem');
const { isExternalEnabled } = require('../utils/externalRecipes');
const { stats: cacheStats, clear: clearCache } = require('../utils/cache');
const { recentErrors } = require('../utils/errorLog');

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parsePageLimit(req) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
  return { page, limit };
}

/** GET /api/admin/stats — counts, cache observability, provider status (no secrets). */
const getStats = asyncHandler(async (req, res) => {
  const [usersByRole, recipesTotal, seeded, adminCreated, favorites, mealPlans, shoppingLists, pantryItems] = await Promise.all([
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    Recipe.countDocuments({}),
    Recipe.countDocuments({ isSeeded: true }),
    Recipe.countDocuments({ createdBy: { $ne: null } }),
    Favorite.countDocuments({}),
    MealPlan.countDocuments({}),
    ShoppingList.countDocuments({}),
    PantryItem.countDocuments({}),
  ]);
  const users = { total: 0, byRole: {} };
  for (const row of usersByRole) {
    users.byRole[row._id || 'unknown'] = row.count;
    users.total += row.count;
  }
  sendSuccess(res, {
    users,
    recipes: { total: recipesTotal, seeded, adminCreated },
    favorites,
    mealPlans,
    shoppingLists,
    pantryItems,
    cache: cacheStats(),
    provider: { enabled: isExternalEnabled() },
  }, 'Admin stats retrieved');
});

/** GET /api/admin/health — uptime + database connection status + provider status. */
const getHealth = asyncHandler(async (req, res) => {
  sendSuccess(res, {
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'not connected',
    databaseState: mongoose.connection.readyState,
    provider: { enabled: isExternalEnabled() },
  }, 'Health retrieved');
});

/** GET /api/admin/logs — most recent server errors, newest first (no secrets). */
const getLogs = asyncHandler(async (req, res) => {
  sendSuccess(res, { logs: recentErrors() }, 'Error logs retrieved');
});

/** GET /api/admin/recipes — paginated, searchable admin recipe list. */
const listAdminRecipes = asyncHandler(async (req, res) => {
  const { page, limit } = parsePageLimit(req);
  const filter = {};
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ title: rx }, { description: rx }, { 'ingredients.name': rx }];
  }
  if (req.query.cuisine) filter.cuisine = new RegExp(`^${escapeRegex(req.query.cuisine)}$`, 'i');
  const [recipes, total] = await Promise.all([
    Recipe.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Recipe.countDocuments(filter),
  ]);
  sendSuccess(res, { recipes, page, limit, total, totalPages: Math.ceil(total / limit) }, 'Recipes retrieved');
});

function validateRecipeBody(body) {
  const errors = [];
  if (!body.title || !String(body.title).trim()) errors.push('title is required');
  if (body.servings != null && (!Number.isInteger(body.servings) || body.servings < 1 || body.servings > 20)) {
    errors.push('servings must be an integer 1–20');
  }
  for (const field of ['preparationTime', 'cookingTime']) {
    if (body[field] != null && (Number.isNaN(Number(body[field])) || Number(body[field]) < 0)) {
      errors.push(`${field} must be a non-negative number`);
    }
  }
  if (body.ingredients != null && !Array.isArray(body.ingredients)) errors.push('ingredients must be an array');
  if (body.instructions != null && !Array.isArray(body.instructions)) errors.push('instructions must be an array');
  if (body.nutrition != null && typeof body.nutrition !== 'object') errors.push('nutrition must be an object');
  return errors;
}

function recipeFields(body, existing = {}) {
  const out = {};
  const set = (key, value) => { if (value !== undefined) out[key] = value; };
  set('title', body.title != null ? String(body.title).trim() : undefined);
  set('description', body.description != null ? String(body.description) : undefined);
  set('image', body.image != null ? String(body.image) : undefined);
  set('ingredients', body.ingredients);
  set('instructions', body.instructions);
  set('preparationTime', body.preparationTime != null ? Number(body.preparationTime) : undefined);
  set('cookingTime', body.cookingTime != null ? Number(body.cookingTime) : undefined);
  set('servings', body.servings != null ? Number(body.servings) : undefined);
  set('cuisine', body.cuisine != null ? String(body.cuisine).trim() : undefined);
  set('mealTypes', body.mealTypes);
  set('dietaryTags', body.dietaryTags);
  set('allergens', body.allergens);
  set('nutrition', body.nutrition);
  set('sourceUrl', body.sourceUrl != null ? String(body.sourceUrl) : undefined);
  return { ...existing, ...out };
}

/** POST /api/admin/recipes — admin-created recipe (isSeeded false, createdBy set). */
const createAdminRecipe = asyncHandler(async (req, res) => {
  const errors = validateRecipeBody(req.body);
  if (errors.length) throw ApiError.badRequest('Validation failed', errors);
  const recipe = await Recipe.create({
    ...recipeFields(req.body),
    isSeeded: false,
    createdBy: req.user._id,
  });
  clearCache();
  sendCreated(res, { recipe }, 'Recipe created');
});

/** PATCH /api/admin/recipes/:id — admin edit. */
const updateAdminRecipe = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid recipe id');
  const recipe = await Recipe.findById(id);
  if (!recipe) throw ApiError.notFound('Recipe not found');
  const errors = validateRecipeBody({ ...recipe.toObject(), ...req.body });
  if (errors.length) throw ApiError.badRequest('Validation failed', errors);
  Object.assign(recipe, recipeFields(req.body));
  await recipe.save();
  clearCache();
  sendSuccess(res, { recipe }, 'Recipe updated');
});

/**
 * DELETE /api/admin/recipes/:id — reference behaviour (documented):
 * the recipe row is removed, but favorites, meal-plan slots, recent
 * views and shopping-list sources that referenced it are KEPT. They
 * resolve gracefully: favorites and planner slots render a "recipe
 * unavailable" state instead of crashing, recent views drop missing
 * recipes, and shopping items keep their names (they are plain text).
 * Nothing is silently cascade-deleted from a user's private data.
 */
const deleteAdminRecipe = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid recipe id');
  const recipe = await Recipe.findById(id);
  if (!recipe) throw ApiError.notFound('Recipe not found');
  await Recipe.deleteOne({ _id: recipe._id });
  clearCache();
  sendSuccess(res, {}, 'Recipe deleted');
});

/**
 * GET /api/admin/categories — distinct cuisines with recipe counts.
 * Cuisines are the recipe category field in this codebase.
 */
const listCategories = asyncHandler(async (req, res) => {
  const rows = await Recipe.aggregate([
    { $group: { _id: '$cuisine', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  sendSuccess(res, {
    categories: rows.map((r) => ({ cuisine: r._id || '', count: r.count })),
  }, 'Categories retrieved');
});

/**
 * PATCH /api/admin/categories/:cuisine — rename a cuisine across all
 * recipes that use it. The cuisine in the URL is matched exactly after
 * trimming; the body must carry the new name. Renaming to a cuisine
 * that already exists merges the two groups (counts simply add up).
 */
const renameCategory = asyncHandler(async (req, res) => {
  const from = decodeURIComponent(req.params.cuisine || '').trim();
  const to = String(req.body.cuisine || req.body.name || '').trim();
  if (!from) throw ApiError.badRequest('Current cuisine is required');
  if (!to) throw ApiError.badRequest('New cuisine name is required');
  if (to.length > 100) throw ApiError.badRequest('Cuisine name must be at most 100 characters');
  const result = await Recipe.updateMany({ cuisine: from }, { $set: { cuisine: to } });
  clearCache();
  sendSuccess(res, { from, to, modifiedCount: result.modifiedCount ?? 0 }, 'Category renamed');
});

module.exports = {
  getStats, getHealth, getLogs,
  listAdminRecipes, createAdminRecipe, updateAdminRecipe, deleteAdminRecipe,
  listCategories, renameCategory,
};
