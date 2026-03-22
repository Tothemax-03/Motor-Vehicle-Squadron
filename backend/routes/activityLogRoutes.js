const express = require('express');
const controller = require('../controllers/activityLogController');
const { requireAuth } = require('../middlewares/auth');
const { requireAdmin } = require('../middlewares/roleMiddleware');

const router = express.Router();

router.get('/', requireAuth, requireAdmin, controller.listActivityLogs);
router.post('/', requireAuth, requireAdmin, controller.createActivityLog);
router.put('/bulk', requireAuth, requireAdmin, controller.bulkUpsertActivityLogs);

module.exports = router;
