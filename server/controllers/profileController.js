const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');

function cleanStringList(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const item of value) {
    const s = String(item || '').trim();
    if (s && !seen.has(s.toLowerCase())) { seen.add(s.toLowerCase()); out.push(s); }
  }
  return out;
}

/** GET /api/profile — the logged-in user's own profile. */
const getProfile = asyncHandler(async (req, res) => {
  sendSuccess(res, { user: req.user.toPublicJSON() }, 'Profile retrieved');
});

/**
 * PATCH /api/profile — edit only the whitelisted profile fields.
 * Role, email and password are never changed here (email/password changes
 * are not part of Phase 2); unknown fields are ignored, not applied.
 */
const updateProfile = asyncHandler(async (req, res) => {
  const user = req.user;
  const b = req.body || {};
  if (b.name !== undefined) user.name = String(b.name).trim();
  if (b.dietaryPreferences !== undefined) user.dietaryPreferences = cleanStringList(b.dietaryPreferences);
  if (b.allergies !== undefined) user.allergies = cleanStringList(b.allergies);
  if (b.preferredCuisines !== undefined) user.preferredCuisines = cleanStringList(b.preferredCuisines);
  if (b.preferredMealTypes !== undefined) user.preferredMealTypes = cleanStringList(b.preferredMealTypes);
  if (b.calorieTarget !== undefined) user.calorieTarget = Number(b.calorieTarget);
  if (b.servingPreference !== undefined) user.servingPreference = Number(b.servingPreference);
  await user.save();
  sendSuccess(res, { user: user.toPublicJSON() }, 'Profile updated');
});

module.exports = { getProfile, updateProfile };
