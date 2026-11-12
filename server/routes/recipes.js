const express = require('express');
const rateLimit = require('express-rate-limit');
const { listRecipes, getRecipe, listByIngredients } = require('../controllers/recipeController');
const { listRecommendations } = require('../controllers/recommendationController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Recipe discovery is a protected, logged-in feature in Phase 1.
const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

// Phase 5: the expensive endpoints get their own, tighter limit on top
// of the general search limit — they scan every recipe to score it.
const expensiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

router.use(protect, searchLimiter);
router.get('/', listRecipes);
router.get('/search', listRecipes); // alias, same controller
// Must come before "/:id" or "by-ingredients" / "recommendations"
// would be treated as an id.
router.get('/by-ingredients', expensiveLimiter, listByIngredients);
router.get('/recommendations', expensiveLimiter, listRecommendations);
router.get('/:id', getRecipe);

module.exports = router;
