const mongoose = require('mongoose');

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snacks'];

// One entry per day/slot. A slot (day + mealType) holds at most one
// recipe — the controller enforces this: setting an occupied slot
// without replace:true is a 409, never a silent duplicate.
const mealEntrySchema = new mongoose.Schema(
  {
    day: { type: Number, min: 0, max: 6, required: true }, // 0 = Monday … 6 = Sunday
    mealType: { type: String, enum: MEAL_TYPES, required: true },
    recipe: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipe', required: true },
    servings: { type: Number, min: 1, max: 20, default: 2 },
  },
  { _id: false }
);

const mealPlanSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Always the Monday of the week (UTC midnight) — see utils/week.js.
    weekStartDate: { type: Date, required: true, index: true },
    meals: { type: [mealEntrySchema], default: [] },
  },
  { timestamps: true }
);

// One plan per user per week.
mealPlanSchema.index({ user: 1, weekStartDate: 1 }, { unique: true });

module.exports = mongoose.model('MealPlan', mealPlanSchema);
module.exports.MEAL_TYPES = MEAL_TYPES;
