const express = require('express');
const { body } = require('express-validator');
const {
  listFavorites, createFavorite, deleteFavorite, assignFavorite,
  listCollections, createCollection, renameCollection, deleteCollection,
} = require('../controllers/favoriteController');
const { protect } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');

const router = express.Router();

// All favorite/collection routes require login, and every controller query
// is scoped to req.user._id — another user's records are never returned
// (lookups that miss the owner scope answer 404, not 403).
router.use(protect);

// Collections first: these paths must be registered before "/:recipeId".
router.get('/collections', listCollections);
router.post(
  '/collections',
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Collection name must be 1–100 characters'),
  handleValidation,
  createCollection
);
router.patch(
  '/collections/:id',
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Collection name must be 1–100 characters'),
  handleValidation,
  renameCollection
);
router.delete('/collections/:id', deleteCollection);

router.get('/', listFavorites);
router.post(
  '/',
  body('recipeId').notEmpty().withMessage('recipeId is required'),
  body('collectionId').optional({ nullable: true }).isMongoId().withMessage('collectionId must be a valid id'),
  handleValidation,
  createFavorite
);
// Favorites are addressed by RECIPE id (see controller notes).
router.patch(
  '/:recipeId',
  body('collectionId').optional({ nullable: true }).isMongoId().withMessage('collectionId must be a valid id'),
  handleValidation,
  assignFavorite
);
router.delete('/:recipeId', deleteFavorite);

module.exports = router;
