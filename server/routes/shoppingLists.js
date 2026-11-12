const express = require('express');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const {
  generateList, listLists, getList, addItem, patchItem, deleteItem, deleteList,
} = require('../controllers/shoppingListController');
const { protect } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');

const router = express.Router();

// All shopping-list routes require login; every controller query is
// scoped to req.user._id — another user's list answers 404, not 403.
router.use(protect);

// Phase 5: generating a list scans a whole week's plan, so it gets its
// own limit (60 per 15 minutes) on top of the login requirement.
const generateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

// Static path before "/:id".
router.post(
  '/generate',
  generateLimiter,
  body('weekStartDate').optional().isISO8601().withMessage('weekStartDate must be a date'),
  body('mealPlanId').optional().isMongoId().withMessage('mealPlanId must be a valid id'),
  handleValidation,
  generateList
);
router.get('/', listLists);
router.get('/:id', getList);
router.post(
  '/:id/items',
  body('name').trim().isLength({ min: 1, max: 200 }).withMessage('Item name must be 1–200 characters'),
  body('quantity').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('quantity must be a non-negative number'),
  handleValidation,
  addItem
);
router.patch('/:id/items/:itemId', patchItem);
router.delete('/:id/items/:itemId', deleteItem);
router.delete('/:id', deleteList);

module.exports = router;
