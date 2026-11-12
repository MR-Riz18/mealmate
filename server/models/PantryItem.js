const mongoose = require('mongoose');

const pantryItemSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 120 },
    quantity: { type: Number, default: null, min: 0 },
    unit: { type: String, default: '', trim: true, maxlength: 30 },
    expirationDate: { type: Date, default: null },
    category: { type: String, default: 'other', trim: true },
  },
  { timestamps: true }
);

// No unique index on (user, name, unit): duplicate detection is by
// normalised name + unit (plural-tolerant, see utils/ingredientMatch.js)
// and is enforced in the controller, which returns 409 for a duplicate.
// That keeps "tomato" and "tomatoes" from becoming two pantry entries
// while still allowing the same ingredient in different units.

module.exports = mongoose.model('PantryItem', pantryItemSchema);
