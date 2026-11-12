const mongoose = require('mongoose');

const collectionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: [true, 'Collection name is required'], trim: true, minlength: 1, maxlength: 100 },
  },
  { timestamps: true }
);

// Collection names are unique per user (two "Quick Meals" lists would be confusing).
collectionSchema.index({ user: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Collection', collectionSchema);
