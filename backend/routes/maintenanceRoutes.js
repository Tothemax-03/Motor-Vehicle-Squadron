const express = require('express');
const controller = require('../controllers/maintenanceController');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();

router.get('/', requireAuth, controller.listMaintenance);
router.get('/alerts', requireAuth, controller.getMaintenanceAlerts);
router.put('/bulk', requireRole('Admin', 'Staff'), controller.bulkUpsertMaintenance);
router.post('/', requireRole('Admin', 'Staff'), controller.createMaintenance);
router.put('/:id', requireRole('Admin', 'Staff'), controller.updateMaintenance);
router.delete('/:id', requireRole('Admin', 'Staff'), controller.deleteMaintenance);

module.exports = router;
