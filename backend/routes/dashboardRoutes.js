const express = require('express');
const controller = require('../controllers/dashboardController');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.get('/summary', requireAuth, controller.getDashboardSummary);

module.exports = router;
