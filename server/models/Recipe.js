const mongoose = require('mongoose');

const ingredientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, default: null },
    unit: { type: String, default: '', trim: true },
    required: { type: Boolean, default: true },
    note: { type: String, default: '', trim: true },
  },
  { _id: false }
);

const nutritionSchema = new mongoose.Schema(
  {
    calories: { type: Number, min: 0, default: null },
    protein: { type: Number, min: 0, default: null },
    carbohydrates: { type: Number, min: 0, default: null },
    fat: { type: Number, min: 0, default: null },
  },
  { _id: false }
);

const recipeSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true },
    description: { type: String, default: '', trim: true },
    image: { type: String, default: '', trim: true },
    ingredients: { type: [ingredientSchema], default: [] },
    instructions: { type: [String], default: [] },
    preparationTime: { type: Number, min: 0, default: 0 }, // minutes
    cookingTime: { type: Number, min: 0, default: 0 }, // minutes
    servings: { type: Number, min: 1, default: 2 },
    cuisine: { type: String, default: '', trim: true },
    mealTypes: { type: [String], default: [] }, // breakfast, lunch, dinner, snacks
    dietaryTags: { type: [String], default: [] },
    allergens: { type: [String], default: [] },
    nutrition: { type: nutritionSchema, default: null },
    sourceUrl: { type: String, default: '', trim: true },
    externalRecipeId: { type: String, default: null },
    isSeeded: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

recipeSchema.virtual('totalTime').get(function () {
  return (this.preparationTime || 0) + (this.cookingTime || 0);
});

recipeSchema.index({ cuisine: 1 });
recipeSchema.index({ dietaryTags: 1 });
recipeSchema.index({ mealTypes: 1 });
recipeSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Recipe', recipeSchema);
