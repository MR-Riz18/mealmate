const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, ApiError } = require('../utils/response');
const Recipe = require('../models/Recipe');
const RecentView = require('../models/RecentView');
const discoveryCache = require('../utils/cache');

/**
 * Phase 5 recently-viewed recording: one record per user per recipe,
 * refreshed on every detail view, pruned to the latest 10 per user.
 * Recording must never break recipe retrieval, so failures are swallowed.
 */
async function recordRecentView(userId, recipeId) {
  try {
    await RecentView.findOneAndUpdate(
      { user: userId, recipe: recipeId },
      { $set: { viewedAt: new Date() } },
      { upsert: true, new: true }
    );
    const extras = await RecentView.find({ user: userId })
      .sort({ viewedAt: -1 })
      .skip(10)
      .select('_id');
    if (extras.length) {
      await RecentView.deleteMany({ _id: { $in: extras.map((v) => v._id) } });
    }
  } catch {
    // Recent views are a convenience feature; a failure here must not
    // turn a successful recipe lookup into an error.
  }
}
const { searchExternalRecipes, getExternalRecipe } = require('../utils/externalRecipes');
const { parseIngredientsParam, matchRecipe } = require('../utils/ingredientMatch');

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parsePageLimit(req) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
  return { page, limit };
}

function buildFilter(query) {
  const filter = {};
  if (query.q) {
    const rx = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ title: rx }, { description: rx }, { 'ingredients.name': rx }];
  }
  if (query.cuisine) filter.cuisine = new RegExp(`^${escapeRegex(query.cuisine)}$`, 'i');
  if (query.dietary) filter.dietaryTags = query.dietary;
  if (query.mealType) filter.mealTypes = query.mealType;
  if (query.maxTime) {
    const max = parseInt(query.maxTime, 10);
    if (!Number.isNaN(max)) {
      filter.$expr = { $lte: [{ $add: ['$preparationTime', '$cookingTime'] }, max] };
    }
  }
  return filter;
}

const listRecipes = asyncHandler(async (req, res) => {
  const { page, limit } = parsePageLimit(req);
  const { q, cuisine, dietary, mealType, maxTime, sort } = req.query;

  // Phase 5 discovery cache: keyed by full URL, 60s TTL. Discovery is
  // not user-specific, so one cached entry serves every logged-in user.
  // Admin recipe changes clear it (see adminController).
  const cacheKey = `discovery:${req.originalUrl}`;
  const cached = discoveryCache.get(cacheKey);
  if (cached) return sendSuccess(res, cached, 'Recipes retrieved');

  // Optional external provider: try it first when a key is configured;
  // any failure or empty result falls back to local seeded recipes.
  if (process.env.RECIPE_API_KEY) {
    const external = await searchExternalRecipes({ q, cuisine, dietary, maxTime, page, limit });
    if (external && external.recipes.length) {
      const data = {
        recipes: external.recipes, page, limit, total: external.total,
        totalPages: Math.ceil(external.total / limit), source: 'external',
      };
      discoveryCache.set(cacheKey, data);
      return sendSuccess(res, data, 'Recipes retrieved');
    }
  }

  const filter = buildFilter(req.query);
  const sortSpec = sort === 'time' ? { preparationTime: 1, cookingTime: 1 } : { createdAt: -1 };
  const [recipes, total] = await Promise.all([
    Recipe.find(filter).sort(sortSpec).skip((page - 1) * limit).limit(limit),
    Recipe.countDocuments(filter),
  ]);
  const data = {
    recipes, page, limit, total, totalPages: Math.ceil(total / limit), source: 'local',
  };
  discoveryCache.set(cacheKey, data);
  sendSuccess(res, data, 'Recipes retrieved');
});

const getRecipe = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (String(id).startsWith('ext-')) {
    const external = await getExternalRecipe(String(id).slice(4));
    if (!external) throw ApiError.notFound('Recipe not found');
    return sendSuccess(res, { recipe: external }, 'Recipe retrieved');
  }
  if (!mongoose.Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid recipe id');
  const recipe = await Recipe.findById(id);
  if (!recipe) throw ApiError.notFound('Recipe not found');
  // Phase 5: viewing a recipe records it for the dashboard's
  // "recently viewed" section (backend-stored, latest 10 per user).
  if (req.user) await recordRecentView(req.user._id, recipe._id);
  sendSuccess(res, { recipe }, 'Recipe retrieved');
});

/**
 * GET /api/recipes/by-ingredients?ingredients=eggs,tomatoes,onions
 * Works on local recipes only (external results do not carry the full
 * ingredient data this match needs). Returns each recipe with its match
 * detail: have, missing (required only), optionalHave, optionalMissing,
 * matchPercentage, isPerfectMatch and additionalIngredientsRequired.
 * Sort: default = best match first; sort=fewest-missing = fewest required
 * ingredients still needed first. "Perfect match" is only set when every
 * required ingredient is present.
 */
const listByIngredients = asyncHandler(async (req, res) => {
  const ingredients = parseIngredientsParam(req.query.ingredients);
  if (ingredients.length === 0) {
    throw ApiError.badRequest('Provide at least one ingredient, e.g. ?ingredients=eggs,tomatoes');
  }
  const { page, limit } = parsePageLimit(req);
  const sort = req.query.sort === 'fewest-missing' ? 'fewest-missing' : 'match';

  const recipes = await Recipe.find({});
  const matched = recipes.map((recipe) => {
    const obj = recipe.toObject({ virtuals: true });
    return { ...obj, match: matchRecipe(recipe, ingredients) };
  });
  matched.sort((a, b) => {
    if (sort === 'fewest-missing') {
      if (a.match.additionalIngredientsRequired !== b.match.additionalIngredientsRequired) {
        return a.match.additionalIngredientsRequired - b.match.additionalIngredientsRequired;
      }
      return b.match.matchPercentage - a.match.matchPercentage;
    }
    if (b.match.matchPercentage !== a.match.matchPercentage) {
      return b.match.matchPercentage - a.match.matchPercentage;
    }
    return a.match.additionalIngredientsRequired - b.match.additionalIngredientsRequired;
  });

  const total = matched.length;
  const pageRecipes = matched.slice((page - 1) * limit, page * limit);
  sendSuccess(res, {
    recipes: pageRecipes, ingredients, sort, page, limit, total,
    totalPages: Math.ceil(total / limit), source: 'local',
  }, 'Recipes matched by ingredients');
});

module.exports = { listRecipes, getRecipe, listByIngredients };
