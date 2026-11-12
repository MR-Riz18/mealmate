const express = require('express');
const {
  getStats, getHealth, getLogs,
  listAdminRecipes, createAdminRecipe, updateAdminRecipe, deleteAdminRecipe,
  listCategories, renameCategory,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Every admin endpoint is gated on the backend: a non-admin gets 403
// here regardless of what the frontend shows or what URL is typed.
router.use(protect, authorize('admin'));

router.get('/stats', getStats);
router.get('/health', getHealth);
router.get('/logs', getLogs);

router.get('/recipes', listAdminRecipes);
router.post('/recipes', createAdminRecipe);
router.patch('/recipes/:id', updateAdminRecipe);
router.delete('/recipes/:id', deleteAdminRecipe);

router.get('/categories', listCategories);
router.patch('/categories/:cuisine', renameCategory);

module.exports = router;
