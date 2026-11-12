const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recipe: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipe', required: true, index: true },
    // Nullable: a favorite may live outside any collection.
    collection: { type: mongoose.Schema.Types.ObjectId, ref: 'Collection', default: null },
  },
  // `collection` is a Mongoose-reserved pathname; the field is intentional
  // (a favorite's collection), so the warning is suppressed deliberately.
  { timestamps: true, suppressReservedKeysWarning: true }
);

// One favorite per user per recipe — enforced at the database level.
favoriteSchema.index({ user: 1, recipe: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', favoriteSchema);
