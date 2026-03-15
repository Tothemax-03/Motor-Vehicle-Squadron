const express = require('express');
const controller = require('../controllers/activityLogController');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();

router.get('/', requireAuth, controller.listActivityLogs);
router.post('/', requireRole('Admin', 'Staff'), controller.createActivityLog);
router.put('/bulk', requireRole('Admin', 'Staff'), controller.bulkUpsertActivityLogs);

module.exports = router;
