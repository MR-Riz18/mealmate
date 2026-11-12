const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const DIETARY_OPTIONS = ['vegetarian', 'vegan', 'halal-friendly', 'gluten-free', 'dairy-free', 'high-protein'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, minlength: 2, maxlength: 100 },
    email: {
      type: String, required: [true, 'Email is required'], unique: true, lowercase: true, trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    // Phase 1 stores these for later phases; the profile editor lands in Phase 2.
    dietaryPreferences: { type: [String], default: [] },
    allergies: { type: [String], default: [] },
    preferredCuisines: { type: [String], default: [] },
    preferredMealTypes: { type: [String], default: [] },
    calorieTarget: { type: Number, min: 0, default: 2000 },
    servingPreference: { type: Number, min: 1, max: 20, default: 2 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Virtual password setter — hashes on save, never stores plaintext.
userSchema.virtual('password')
  .set(function (value) { this._password = value; });

// NOTE: must be pre('validate'), not pre('save') — Mongoose runs validation
// before pre('save') hooks, and passwordHash is a required path.
userSchema.pre('validate', async function () {
  if (this._password) {
    this.passwordHash = await bcrypt.hash(this._password, 10);
    this._password = undefined;
  }
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

userSchema.methods.toPublicJSON = function () {
  return {
    id: this._id, name: this.name, email: this.email, role: this.role,
    dietaryPreferences: this.dietaryPreferences, allergies: this.allergies,
    preferredCuisines: this.preferredCuisines, preferredMealTypes: this.preferredMealTypes,
    calorieTarget: this.calorieTarget, servingPreference: this.servingPreference,
  };
};

module.exports = mongoose.model('User', userSchema);
module.exports.DIETARY_OPTIONS = DIETARY_OPTIONS;
