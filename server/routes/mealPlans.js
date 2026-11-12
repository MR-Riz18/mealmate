const express = require('express');
const { body } = require('express-validator');
const {
  getPlanForWeek, listPlans, getPlan, createPlan, patchPlan, deletePlan,
} = require('../controllers/mealPlanController');
const { protect } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');

const router = express.Router();

// All meal-plan routes require login; every controller query is scoped
// to req.user._id — another user's plan answers 404, not 403.
router.use(protect);

// Static paths before "/:id" so they are not treated as plan ids.
router.get('/', getPlanForWeek);
router.get('/list', listPlans);
router.post(
  '/',
  body('weekStartDate').optional().isISO8601().withMessage('weekStartDate must be a date'),
  handleValidation,
  createPlan
);
router.get('/:id', getPlan);
router.patch(
  '/:id',
  body('action').isIn(['set', 'remove', 'copy', 'clearDay']).withMessage('action must be set, remove, copy or clearDay'),
  body('day').optional().isInt({ min: 0, max: 6 }).withMessage('day must be an integer 0–6'),
  body('fromDay').optional().isInt({ min: 0, max: 6 }).withMessage('fromDay must be an integer 0–6'),
  body('toDay').optional().isInt({ min: 0, max: 6 }).withMessage('toDay must be an integer 0–6'),
  body('mealType').optional().isIn(['breakfast', 'lunch', 'dinner', 'snacks']).withMessage('mealType must be breakfast, lunch, dinner or snacks'),
  body('servings').optional().isInt({ min: 1, max: 20 }).withMessage('servings must be an integer 1–20'),
  handleValidation,
  patchPlan
);
router.delete('/:id', deletePlan);

module.exports = router;
