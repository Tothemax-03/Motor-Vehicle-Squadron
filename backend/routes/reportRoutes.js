const express = require('express');
const controller = require('../controllers/reportController');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.get('/vehicle-usage', requireAuth, controller.getVehicleUsageReport);
router.get('/maintenance', requireAuth, controller.getMaintenanceReport);

router.get('/vehicle-usage/csv', requireAuth, controller.exportVehicleUsageCsv);
router.get('/vehicle-usage/pdf', requireAuth, controller.exportVehicleUsagePdf);
router.get('/maintenance/csv', requireAuth, controller.exportMaintenanceCsv);
router.get('/maintenance/pdf', requireAuth, controller.exportMaintenancePdf);
router.get('/analytics-pack/json', requireAuth, controller.exportAnalyticsPack);

module.exports = router;
