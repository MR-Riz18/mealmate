const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated, ApiError } = require('../utils/response');
const MealPlan = require('../models/MealPlan');
const ShoppingList = require('../models/ShoppingList');
const PantryItem = require('../models/PantryItem');
const { toMonday } = require('../utils/week');
const { generateAutoItems, mergeRegeneratedItems, categorize, normalizeName, normalizeUnit, markInPantry } = require('../utils/shopping');

async function loadList(req) {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid shopping list id');
  // User-scoped: another user's list is simply not found (404, not 403).
  const list = await ShoppingList.findOne({ _id: id, user: req.user._id });
  if (!list) throw ApiError.notFound('Shopping list not found');
  return list;
}

function groupedItems(list) {
  const groups = {};
  for (const item of list.items) {
    const cat = item.category || 'other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  }
  return groups;
}

async function pantryNamesFor(req) {
  const items = await PantryItem.find({ user: req.user._id }).select('name');
  return items.map((i) => i.name);
}

/**
 * Phase 4 pantry flag: when pantry names are supplied, every item gets
 * inPantry recomputed from the CURRENT pantry, so a pantry change after
 * generation is reflected on the next read. The flag is display only:
 * the line stays on the list and no quantity is subtracted.
 */
function listJSON(list, pantryNames = null) {
  const obj = list.toObject();
  const items = pantryNames ? markInPantry(obj.items, pantryNames) : obj.items;
  const withFlag = { ...obj, items };
  return { ...withFlag, groupedItems: groupedItems(withFlag) };
}

/**
 * POST /api/shopping-lists/generate
 * Body: { weekStartDate?, mealPlanId? } — at least one is required.
 * mealPlanId wins when both are given (it must belong to the user).
 * Otherwise the plan for the normalised Monday of weekStartDate is used.
 * If a list already exists for that week it is REGENERATED (manual items
 * and checked states of surviving auto items are preserved) and returned
 * with 200; otherwise a new list is created (201).
 */
const generateList = asyncHandler(async (req, res) => {
  const { weekStartDate, mealPlanId } = req.body;
  let plan;
  if (mealPlanId) {
    if (!mongoose.Types.ObjectId.isValid(mealPlanId)) throw ApiError.badRequest('Invalid mealPlanId');
    plan = await MealPlan.findOne({ _id: mealPlanId, user: req.user._id }).populate('meals.recipe');
    if (!plan) throw ApiError.notFound('Meal plan not found');
  } else {
    if (!weekStartDate) throw ApiError.badRequest('Provide weekStartDate or mealPlanId');
    const monday = toMonday(weekStartDate);
    if (!monday) throw ApiError.badRequest('Invalid weekStartDate');
    plan = await MealPlan.findOne({ user: req.user._id, weekStartDate: monday }).populate('meals.recipe');
    if (!plan) throw ApiError.notFound('No meal plan for that week yet');
  }

  const recipesById = new Map();
  for (const meal of plan.meals) {
    if (meal.recipe && meal.recipe._id) recipesById.set(String(meal.recipe._id), meal.recipe);
  }
  const pantryNames = await pantryNamesFor(req);
  const autoItems = markInPantry(generateAutoItems(plan.meals, recipesById), pantryNames);

  const existing = await ShoppingList.findOne({ user: req.user._id, weekStartDate: plan.weekStartDate });
  if (existing) {
    existing.items = mergeRegeneratedItems(existing.items, autoItems);
    existing.mealPlan = plan._id;
    await existing.save();
    return sendSuccess(res, listJSON(existing, pantryNames), 'Shopping list regenerated');
  }
  const list = await ShoppingList.create({
    user: req.user._id, weekStartDate: plan.weekStartDate, mealPlan: plan._id, items: autoItems,
  });
  sendCreated(res, listJSON(list, pantryNames), 'Shopping list generated');
});

/** GET /api/shopping-lists — the user's lists, newest first. */
const listLists = asyncHandler(async (req, res) => {
  const lists = await ShoppingList.find({ user: req.user._id }).sort({ weekStartDate: -1, createdAt: -1 });
  const pantryNames = await pantryNamesFor(req);
  sendSuccess(res, { lists: lists.map((l) => listJSON(l, pantryNames)) }, 'Shopping lists retrieved');
});

/** GET /api/shopping-lists/:id — one list, grouped by category. */
const getList = asyncHandler(async (req, res) => {
  const list = await loadList(req);
  sendSuccess(res, listJSON(list, await pantryNamesFor(req)), 'Shopping list retrieved');
});

/** POST /api/shopping-lists/:id/items — manual entry (manual: true). */
const addItem = asyncHandler(async (req, res) => {
  const list = await loadList(req);
  const name = String(req.body.name || '').trim();
  if (!name) throw ApiError.badRequest('Item name is required');
  const quantity = req.body.quantity == null ? null : Number(req.body.quantity);
  if (quantity != null && (Number.isNaN(quantity) || quantity < 0)) throw ApiError.badRequest('quantity must be a non-negative number');
  list.items.push({
    name,
    quantity,
    unit: String(req.body.unit || '').trim(),
    category: String(req.body.category || '').trim() || categorize(name),
    checked: false,
    manual: true,
    sources: [],
  });
  await list.save();
  sendCreated(res, listJSON(list, await pantryNamesFor(req)), 'Item added');
});

/** PATCH /api/shopping-lists/:id/items/:itemId — check off or edit an item. */
const patchItem = asyncHandler(async (req, res) => {
  const list = await loadList(req);
  const { itemId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(itemId)) throw ApiError.badRequest('Invalid item id');
  const item = list.items.id(itemId);
  if (!item) throw ApiError.notFound('Item not found');
  if (req.body.checked !== undefined) item.checked = !!req.body.checked;
  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) throw ApiError.badRequest('Item name is required');
    item.name = name;
  }
  if (req.body.quantity !== undefined) {
    const quantity = req.body.quantity == null ? null : Number(req.body.quantity);
    if (quantity != null && (Number.isNaN(quantity) || quantity < 0)) throw ApiError.badRequest('quantity must be a non-negative number');
    item.quantity = quantity;
  }
  if (req.body.unit !== undefined) item.unit = String(req.body.unit).trim();
  if (req.body.category !== undefined) item.category = String(req.body.category).trim() || categorize(item.name);
  await list.save();
  sendSuccess(res, listJSON(list, await pantryNamesFor(req)), 'Item updated');
});

/** DELETE /api/shopping-lists/:id/items/:itemId */
const deleteItem = asyncHandler(async (req, res) => {
  const list = await loadList(req);
  const { itemId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(itemId)) throw ApiError.badRequest('Invalid item id');
  const item = list.items.id(itemId);
  if (!item) throw ApiError.notFound('Item not found');
  item.deleteOne();
  await list.save();
  sendSuccess(res, listJSON(list, await pantryNamesFor(req)), 'Item removed');
});

/** DELETE /api/shopping-lists/:id */
const deleteList = asyncHandler(async (req, res) => {
  const list = await loadList(req);
  await ShoppingList.deleteOne({ _id: list._id });
  sendSuccess(res, {}, 'Shopping list deleted');
});

module.exports = { generateList, listLists, getList, addItem, patchItem, deleteItem, deleteList, _internals: { normalizeName, normalizeUnit } };
