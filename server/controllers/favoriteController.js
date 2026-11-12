const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated, ApiError } = require('../utils/response');
const Favorite = require('../models/Favorite');
const Collection = require('../models/Collection');
const Recipe = require('../models/Recipe');

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function populateFavorite(q) {
  return q.populate('recipe').populate('collection', 'name');
}

function toFavoriteJSON(fav) {
  return fav;
}

/** GET /api/favorites — the logged-in user's saved recipes, with filters. */
const listFavorites = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
  const { q, cuisine, dietary, mealType, collection } = req.query;

  // Search/filter applies to the underlying recipe, so resolve matching
  // recipe ids first, then restrict favorites to those recipes.
  const recipeFilter = {};
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    recipeFilter.$or = [{ title: rx }, { description: rx }, { 'ingredients.name': rx }];
  }
  if (cuisine) recipeFilter.cuisine = new RegExp(`^${escapeRegex(cuisine)}$`, 'i');
  if (dietary) recipeFilter.dietaryTags = dietary;
  if (mealType) recipeFilter.mealTypes = mealType;
  const hasRecipeFilter = Object.keys(recipeFilter).length > 0;
  let recipeIds = null;
  if (hasRecipeFilter) {
    recipeIds = (await Recipe.find(recipeFilter).select('_id')).map((r) => r._id);
    if (recipeIds.length === 0) {
      return sendSuccess(res, { favorites: [], page, limit, total: 0, totalPages: 0 }, 'Favorites retrieved');
    }
  }

  const filter = { user: req.user._id };
  if (recipeIds) filter.recipe = { $in: recipeIds };
  if (collection === 'none') filter.collection = null;
  else if (collection) {
    if (!mongoose.Types.ObjectId.isValid(collection)) throw ApiError.badRequest('Invalid collection id');
    // A collection id that is not the user's simply matches nothing —
    // we never reveal another user's collections.
    const own = await Collection.findOne({ _id: collection, user: req.user._id }).select('_id');
    if (!own) {
      return sendSuccess(res, { favorites: [], page, limit, total: 0, totalPages: 0 }, 'Favorites retrieved');
    }
    filter.collection = collection;
  }

  const [favorites, total] = await Promise.all([
    populateFavorite(Favorite.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)),
    Favorite.countDocuments(filter),
  ]);
  sendSuccess(res, {
    favorites, page, limit, total, totalPages: Math.ceil(total / limit),
  }, 'Favorites retrieved');
});

/**
 * POST /api/favorites — save a recipe. Duplicate saves are idempotent:
 * saving a recipe that is already favorited returns the existing favorite
 * with 200 instead of an error, so a toggle button can call this safely.
 * Body: { recipeId, collectionId? }
 */
const createFavorite = asyncHandler(async (req, res) => {
  const { recipeId, collectionId } = req.body;
  if (!mongoose.Types.ObjectId.isValid(recipeId)) throw ApiError.badRequest('Invalid recipe id');
  const recipe = await Recipe.findById(recipeId);
  if (!recipe) throw ApiError.notFound('Recipe not found');

  let collection = null;
  if (collectionId) {
    if (!mongoose.Types.ObjectId.isValid(collectionId)) throw ApiError.badRequest('Invalid collection id');
    collection = await Collection.findOne({ _id: collectionId, user: req.user._id });
    if (!collection) throw ApiError.notFound('Collection not found');
  }

  const existing = await populateFavorite(Favorite.findOne({ user: req.user._id, recipe: recipeId }));
  if (existing) {
    return sendSuccess(res, { favorite: toFavoriteJSON(existing) }, 'Recipe is already in favorites');
  }

  const favorite = await Favorite.create({
    user: req.user._id, recipe: recipeId, collection: collection ? collection._id : null,
  });
  const populated = await populateFavorite(Favorite.findById(favorite._id));
  sendCreated(res, { favorite: toFavoriteJSON(populated) }, 'Recipe saved to favorites');
});

/**
 * DELETE /api/favorites/:recipeId — remove by RECIPE id (not favorite id),
 * because the frontend toggle only knows the recipe it is showing.
 * Another user's favorite is simply not found for this user (404).
 */
const deleteFavorite = asyncHandler(async (req, res) => {
  const { recipeId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(recipeId)) throw ApiError.badRequest('Invalid recipe id');
  const removed = await Favorite.findOneAndDelete({ user: req.user._id, recipe: recipeId });
  if (!removed) throw ApiError.notFound('Favorite not found');
  sendSuccess(res, {}, 'Recipe removed from favorites');
});

/**
 * PATCH /api/favorites/:recipeId — move a favorite into/out of a collection.
 * Body: { collectionId: "<id>" | null }
 */
const assignFavorite = asyncHandler(async (req, res) => {
  const { recipeId } = req.params;
  const { collectionId } = req.body;
  if (!mongoose.Types.ObjectId.isValid(recipeId)) throw ApiError.badRequest('Invalid recipe id');
  const favorite = await Favorite.findOne({ user: req.user._id, recipe: recipeId });
  if (!favorite) throw ApiError.notFound('Favorite not found');

  if (collectionId) {
    if (!mongoose.Types.ObjectId.isValid(collectionId)) throw ApiError.badRequest('Invalid collection id');
    const collection = await Collection.findOne({ _id: collectionId, user: req.user._id });
    if (!collection) throw ApiError.notFound('Collection not found');
    favorite.collection = collection._id;
  } else {
    favorite.collection = null;
  }
  await favorite.save();
  const populated = await populateFavorite(Favorite.findById(favorite._id));
  sendSuccess(res, { favorite: toFavoriteJSON(populated) }, 'Favorite collection updated');
});

/** GET /api/favorites/collections — the user's own collections. */
const listCollections = asyncHandler(async (req, res) => {
  const collections = await Collection.find({ user: req.user._id }).sort({ name: 1 });
  sendSuccess(res, { collections }, 'Collections retrieved');
});

/** POST /api/favorites/collections — create a collection. Body: { name } */
const createCollection = asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) throw ApiError.badRequest('Collection name is required');
  const existing = await Collection.findOne({ user: req.user._id, name });
  if (existing) throw ApiError.conflict('A collection with this name already exists');
  const collection = await Collection.create({ user: req.user._id, name });
  sendCreated(res, { collection }, 'Collection created');
});

/** PATCH /api/favorites/collections/:id — rename. Other users' records: 404. */
const renameCollection = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid collection id');
  const name = String(req.body.name || '').trim();
  if (!name) throw ApiError.badRequest('Collection name is required');
  const collection = await Collection.findOne({ _id: id, user: req.user._id });
  if (!collection) throw ApiError.notFound('Collection not found');
  const clash = await Collection.findOne({ user: req.user._id, name, _id: { $ne: collection._id } });
  if (clash) throw ApiError.conflict('A collection with this name already exists');
  collection.name = name;
  await collection.save();
  sendSuccess(res, { collection }, 'Collection renamed');
});

/** DELETE /api/favorites/collections/:id — delete; favorites keep the recipe, lose the collection. */
const deleteCollection = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid collection id');
  const collection = await Collection.findOneAndDelete({ _id: id, user: req.user._id });
  if (!collection) throw ApiError.notFound('Collection not found');
  await Favorite.updateMany({ user: req.user._id, collection: collection._id }, { $set: { collection: null } });
  sendSuccess(res, {}, 'Collection deleted');
});

module.exports = {
  listFavorites, createFavorite, deleteFavorite, assignFavorite,
  listCollections, createCollection, renameCollection, deleteCollection,
};
