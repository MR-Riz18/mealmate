const mongoose = require('mongoose');

// Recently viewed recipes — Phase 5. Stored on the backend (never only
// in localStorage) so "recently viewed" survives logout, login and a
// different device. One record per user per recipe; viewing again just
// refreshes viewedAt. The dashboard keeps only the latest 10 per user.
const recentViewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recipe: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipe', required: true, index: true },
    viewedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

recentViewSchema.index({ user: 1, recipe: 1 }, { unique: true });

module.exports = mongoose.model('RecentView', recentViewSchema);
