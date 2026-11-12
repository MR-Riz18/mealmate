const express = require('express');
const { getDashboard } = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Logged-in user's own aggregated home view. Never cached: it is
// user-specific and must reflect the latest plan, pantry and views.
router.get('/', protect, getDashboard);

module.exports = router;
