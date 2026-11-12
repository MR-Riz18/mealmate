const express = require('express');
const { body } = require('express-validator');
const { listPantry, createPantryItem, updatePantryItem, deletePantryItem } = require('../controllers/pantryController');
const { protect } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');

const router = express.Router();

// All pantry routes require login, and every controller query is scoped
// to req.user._id — another user's items answer 404, not 403.
router.use(protect);

router.get('/', listPantry);
router.post(
  '/',
  body('name').trim().isLength({ min: 1, max: 120 }).withMessage('Item name must be 1–120 characters'),
  body('quantity').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('quantity must be a non-negative number'),
  body('unit').optional().trim().isLength({ max: 30 }).withMessage('unit must be at most 30 characters'),
  body('expirationDate').optional({ nullable: true }).isISO8601().withMessage('expirationDate must be a valid date'),
  handleValidation,
  createPantryItem
);
router.patch(
  '/:id',
  body('name').optional().trim().isLength({ min: 1, max: 120 }).withMessage('Item name must be 1–120 characters'),
  body('quantity').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('quantity must be a non-negative number'),
  body('unit').optional().trim().isLength({ max: 30 }).withMessage('unit must be at most 30 characters'),
  body('expirationDate').optional({ nullable: true }).isISO8601().withMessage('expirationDate must be a valid date'),
  handleValidation,
  updatePantryItem
);
router.delete('/:id', deletePantryItem);

module.exports = router;
