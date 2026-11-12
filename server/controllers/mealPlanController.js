const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated, ApiError } = require('../utils/response');
const MealPlan = require('../models/MealPlan');
const Recipe = require('../models/Recipe');
const User = require('../models/User');
const { toMonday, currentMonday, formatDateYYYYMMDD } = require('../utils/week');
const { computeDaySummaries } = require('../utils/nutrition');

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snacks'];

function isValidDay(day) {
  return Number.isInteger(day) && day >= 0 && day <= 6;
}

async function loadPlan(req) {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid meal plan id');
  // User-scoped: another user's plan is simply not found (404, not 403).
  const plan = await MealPlan.findOne({ _id: id, user: req.user._id }).populate('meals.recipe');
  if (!plan) throw ApiError.notFound('Meal plan not found');
  return plan;
}

function planJSON(plan, calorieTarget) {
  const obj = plan.toObject();
  const recipesById = new Map();
  for (const meal of plan.meals) {
    if (meal.recipe && meal.recipe._id) recipesById.set(String(meal.recipe._id), meal.recipe);
  }
  const daySummaries = computeDaySummaries(plan.meals, recipesById).map((s) => ({
    ...s,
    calorieTarget: calorieTarget != null ? calorieTarget : null,
    caloriesVsTarget: calorieTarget != null ? Math.round((s.totals.calories - calorieTarget) * 10) / 10 : null,
  }));
  return { ...obj, weekStartDateLabel: formatDateYYYYMMDD(plan.weekStartDate), daySummaries };
}

async function calorieTargetFor(req) {
  const user = await User.findById(req.user._id).select('calorieTarget');
  return user ? user.calorieTarget : null;
}

/**
 * GET /api/meal-plans?weekStartDate=YYYY-MM-DD
 * No query (or no plan for that week) returns the week, with plan null
 * when the user has not created one yet — GET never creates a plan.
 * Without weekStartDate the current week is used.
 */
const getPlanForWeek = asyncHandler(async (req, res) => {
  const monday = req.query.weekStartDate ? toMonday(req.query.weekStartDate) : currentMonday();
  if (!monday) throw ApiError.badRequest('Invalid weekStartDate');
  const plan = await MealPlan.findOne({ user: req.user._id, weekStartDate: monday }).populate('meals.recipe');
  const target = await calorieTargetFor(req);
  if (!plan) {
    return sendSuccess(res, {
      plan: null, weekStartDate: monday, weekStartDateLabel: formatDateYYYYMMDD(monday),
      daySummaries: computeDaySummaries([], new Map()), calorieTarget: target,
    }, 'No meal plan for this week yet');
  }
  // Always the same wrapper shape as the no-plan case: { plan, ... }.
  const full = planJSON(plan, target);
  sendSuccess(res, {
    plan: full, weekStartDate: monday, weekStartDateLabel: formatDateYYYYMMDD(monday),
    daySummaries: full.daySummaries, calorieTarget: target,
  }, 'Meal plan retrieved');
});

/** GET /api/meal-plans/list — all of the user's plans, newest week first. */
const listPlans = asyncHandler(async (req, res) => {
  const plans = await MealPlan.find({ user: req.user._id }).sort({ weekStartDate: -1 });
  sendSuccess(res, { plans }, 'Meal plans retrieved');
});

/** GET /api/meal-plans/:id — one plan with per-day nutrition summaries. */
const getPlan = asyncHandler(async (req, res) => {
  const plan = await loadPlan(req);
  const target = await calorieTargetFor(req);
  sendSuccess(res, planJSON(plan, target), 'Meal plan retrieved');
});

/**
 * POST /api/meal-plans — create the plan for a week, or return the
 * existing one (200) when the user already has one for that Monday.
 * Body: { weekStartDate? } — any date is normalised to its Monday.
 */
const createPlan = asyncHandler(async (req, res) => {
  const monday = req.body.weekStartDate ? toMonday(req.body.weekStartDate) : currentMonday();
  if (!monday) throw ApiError.badRequest('Invalid weekStartDate');
  const existing = await MealPlan.findOne({ user: req.user._id, weekStartDate: monday }).populate('meals.recipe');
  const target = await calorieTargetFor(req);
  if (existing) {
    return sendSuccess(res, planJSON(existing, target), 'Meal plan already exists for this week');
  }
  const plan = await MealPlan.create({ user: req.user._id, weekStartDate: monday, meals: [] });
  const populated = await MealPlan.findById(plan._id).populate('meals.recipe');
  sendCreated(res, planJSON(populated, target), 'Meal plan created');
});

/**
 * PATCH /api/meal-plans/:id — slot operations. Body: { action, ... }.
 * - set:    { day, mealType, recipeId, servings?, replace? }
 *           Setting an occupied slot without replace:true is a 409 —
 *           a slot must never silently duplicate or overwrite.
 * - remove: { day, mealType }
 * - copy:   { fromDay, mealType, toDay, replace? } — same occupied-slot
 *           rule applies to the target slot.
 * - clearDay: { day }
 */
const patchPlan = asyncHandler(async (req, res) => {
  const plan = await loadPlan(req);
  const { action } = req.body;

  if (action === 'set') {
    const { day, mealType, recipeId, servings, replace } = req.body;
    if (!isValidDay(day)) throw ApiError.badRequest('day must be an integer 0–6 (0 = Monday)');
    if (!MEAL_TYPES.includes(mealType)) throw ApiError.badRequest('mealType must be breakfast, lunch, dinner or snacks');
    if (!mongoose.Types.ObjectId.isValid(recipeId)) throw ApiError.badRequest('Invalid recipe id');
    const recipe = await Recipe.findById(recipeId);
    if (!recipe) throw ApiError.notFound('Recipe not found');
    const sv = servings == null ? (recipe.servings || 2) : servings;
    if (!Number.isInteger(sv) || sv < 1 || sv > 20) throw ApiError.badRequest('servings must be an integer 1–20');
    const idx = plan.meals.findIndex((m) => m.day === day && m.mealType === mealType);
    if (idx >= 0 && !replace) {
      throw ApiError.conflict('That slot already has a recipe. Send replace: true to replace it.');
    }
    const entry = { day, mealType, recipe: recipe._id, servings: sv };
    if (idx >= 0) plan.meals[idx] = entry;
    else plan.meals.push(entry);
  } else if (action === 'remove') {
    const { day, mealType } = req.body;
    if (!isValidDay(day)) throw ApiError.badRequest('day must be an integer 0–6 (0 = Monday)');
    if (!MEAL_TYPES.includes(mealType)) throw ApiError.badRequest('mealType must be breakfast, lunch, dinner or snacks');
    plan.meals = plan.meals.filter((m) => !(m.day === day && m.mealType === mealType));
  } else if (action === 'copy') {
    const { fromDay, mealType, toDay, replace } = req.body;
    if (!isValidDay(fromDay) || !isValidDay(toDay)) throw ApiError.badRequest('fromDay and toDay must be integers 0–6 (0 = Monday)');
    if (!MEAL_TYPES.includes(mealType)) throw ApiError.badRequest('mealType must be breakfast, lunch, dinner or snacks');
    const source = plan.meals.find((m) => m.day === fromDay && m.mealType === mealType);
    if (!source) throw ApiError.notFound('No planned meal to copy from that slot');
    const idx = plan.meals.findIndex((m) => m.day === toDay && m.mealType === mealType);
    if (idx >= 0 && !replace) {
      throw ApiError.conflict('The target slot already has a recipe. Send replace: true to replace it.');
    }
    const entry = { day: toDay, mealType, recipe: source.recipe, servings: source.servings };
    if (idx >= 0) plan.meals[idx] = entry;
    else plan.meals.push(entry);
  } else if (action === 'clearDay') {
    const { day } = req.body;
    if (!isValidDay(day)) throw ApiError.badRequest('day must be an integer 0–6 (0 = Monday)');
    plan.meals = plan.meals.filter((m) => m.day !== day);
  } else {
    throw ApiError.badRequest('action must be set, remove, copy or clearDay');
  }

  await plan.save();
  const populated = await MealPlan.findById(plan._id).populate('meals.recipe');
  const target = await calorieTargetFor(req);
  sendSuccess(res, planJSON(populated, target), 'Meal plan updated');
});

/** DELETE /api/meal-plans/:id — clear a whole week's plan. */
const deletePlan = asyncHandler(async (req, res) => {
  const plan = await loadPlan(req);
  await MealPlan.deleteOne({ _id: plan._id });
  sendSuccess(res, {}, 'Meal plan deleted');
});

module.exports = { getPlanForWeek, listPlans, getPlan, createPlan, patchPlan, deletePlan, MEAL_TYPES };
