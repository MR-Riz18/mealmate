const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated, ApiError } = require('../utils/response');
const PantryItem = require('../models/PantryItem');
const { categorize } = require('../utils/shopping');
const { normalizeIngredient } = require('../utils/ingredientMatch');
const { classifyExpiry, daysUntil } = require('../utils/expiry');

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pantryJSON(item, now = new Date()) {
  const obj = item.toObject ? item.toObject() : item;
  const expiryStatus = classifyExpiry(obj.expirationDate, now);
  return { ...obj, expiryStatus, daysUntilExpiry: daysUntil(obj.expirationDate, now) };
}

async function loadItem(req) {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid pantry item id');
  // User-scoped: another user's item is simply not found (404, not 403).
  const item = await PantryItem.findOne({ _id: id, user: req.user._id });
  if (!item) throw ApiError.notFound('Pantry item not found');
  return item;
}

/** Find a duplicate: same normalised name + same normalised unit for this user. */
async function findDuplicate(userId, name, unit, excludeId = null) {
  const items = await PantryItem.find({ user: userId });
  const key = `${normalizeIngredient(name)}|${String(unit || '').trim().toLowerCase()}`;
  return items.find((i) => {
    if (excludeId && String(i._id) === String(excludeId)) return false;
    return `${normalizeIngredient(i.name)}|${String(i.unit || '').trim().toLowerCase()}` === key;
  }) || null;
}

function parseQuantity(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (Number.isNaN(n) || n < 0) throw ApiError.badRequest('quantity must be a non-negative number');
  return n;
}

function parseExpiration(value) {
  if (value == null || value === '') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw ApiError.badRequest('expirationDate must be a valid date');
  return d;
}

/** GET /api/pantry?q= — the user's items, with expiry classification. */
const listPantry = asyncHandler(async (req, res) => {
  let items = await PantryItem.find({ user: req.user._id }).sort({ expirationDate: 1, name: 1 });
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    items = items.filter((i) => rx.test(i.name) || rx.test(i.category || ''));
  }
  sendSuccess(res, { items: items.map((i) => pantryJSON(i)) }, 'Pantry retrieved');
});

/** POST /api/pantry — duplicate name+unit for this user is a 409 (edit it instead). */
const createPantryItem = asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) throw ApiError.badRequest('Item name is required');
  const unit = String(req.body.unit || '').trim();
  const duplicate = await findDuplicate(req.user._id, name, unit);
  if (duplicate) {
    throw ApiError.conflict(`"${duplicate.name}" is already in your pantry with that unit — edit its quantity instead`);
  }
  const item = await PantryItem.create({
    user: req.user._id,
    name,
    quantity: parseQuantity(req.body.quantity),
    unit,
    expirationDate: parseExpiration(req.body.expirationDate),
    category: String(req.body.category || '').trim() || categorize(name),
  });
  sendCreated(res, { item: pantryJSON(item) }, 'Pantry item added');
});

/** PATCH /api/pantry/:id — edit any field; renaming into a duplicate is a 409. */
const updatePantryItem = asyncHandler(async (req, res) => {
  const item = await loadItem(req);
  const name = req.body.name !== undefined ? String(req.body.name).trim() : item.name;
  const unit = req.body.unit !== undefined ? String(req.body.unit).trim() : item.unit;
  if (req.body.name !== undefined && !name) throw ApiError.badRequest('Item name is required');
  const duplicate = await findDuplicate(req.user._id, name, unit, item._id);
  if (duplicate) {
    throw ApiError.conflict(`"${duplicate.name}" is already in your pantry with that unit`);
  }
  item.name = name;
  item.unit = unit;
  if (req.body.quantity !== undefined) item.quantity = parseQuantity(req.body.quantity);
  if (req.body.expirationDate !== undefined) item.expirationDate = parseExpiration(req.body.expirationDate);
  if (req.body.category !== undefined) item.category = String(req.body.category).trim() || categorize(name);
  await item.save();
  sendSuccess(res, { item: pantryJSON(item) }, 'Pantry item updated');
});

/** DELETE /api/pantry/:id */
const deletePantryItem = asyncHandler(async (req, res) => {
  const item = await loadItem(req);
  await PantryItem.deleteOne({ _id: item._id });
  sendSuccess(res, {}, 'Pantry item removed');
});

module.exports = { listPantry, createPantryItem, updatePantryItem, deletePantryItem, pantryJSON, findDuplicate };
