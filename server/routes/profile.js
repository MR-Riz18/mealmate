const express = require('express');
const { body } = require('express-validator');
const { DIETARY_OPTIONS } = require('../models/User');
const { getProfile, updateProfile } = require('../controllers/profileController');
const { protect } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snacks'];

const router = express.Router();

router.use(protect);

router.get('/', getProfile);
router.patch(
  '/',
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),
  body('dietaryPreferences').optional().isArray().withMessage('dietaryPreferences must be a list'),
  body('dietaryPreferences.*').isIn(DIETARY_OPTIONS).withMessage('Unknown dietary preference'),
  body('allergies').optional().isArray().withMessage('allergies must be a list'),
  body('allergies.*').trim().isLength({ max: 50 }).withMessage('Allergy entries must be at most 50 characters'),
  body('preferredCuisines').optional().isArray().withMessage('preferredCuisines must be a list'),
  body('preferredCuisines.*').trim().isLength({ max: 100 }).withMessage('Cuisine entries must be at most 100 characters'),
  body('preferredMealTypes').optional().isArray().withMessage('preferredMealTypes must be a list'),
  body('preferredMealTypes.*').isIn(MEAL_TYPES).withMessage('Unknown meal type'),
  body('calorieTarget').optional().isInt({ min: 0, max: 10000 }).withMessage('calorieTarget must be between 0 and 10000'),
  body('servingPreference').optional().isInt({ min: 1, max: 20 }).withMessage('servingPreference must be between 1 and 20'),
  handleValidation,
  updateProfile
);

module.exports = router;
