const mongoose = require('mongoose');

const shoppingItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, default: null },
    unit: { type: String, default: '', trim: true },
    category: { type: String, default: 'other', trim: true },
    checked: { type: Boolean, default: false },
    manual: { type: Boolean, default: false },
    // Phase 4: true when the item name matches a pantry item. Display
    // only — the line is kept and quantities are NEVER subtracted.
    inPantry: { type: Boolean, default: false },
    sources: { type: [String], default: [] }, // recipe titles this item came from (auto items)
  },
  { _id: true }
);

const shoppingListSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // The week this list was generated from; null for a purely manual list.
    weekStartDate: { type: Date, default: null, index: true },
    mealPlan: { type: mongoose.Schema.Types.ObjectId, ref: 'MealPlan', default: null },
    items: { type: [shoppingItemSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ShoppingList', shoppingListSchema);
