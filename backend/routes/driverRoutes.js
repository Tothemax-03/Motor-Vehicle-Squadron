const express = require('express');
const controller = require('../controllers/driverController');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();

router.get('/', requireAuth, controller.listDrivers);
router.put('/bulk', requireRole('Admin', 'Staff'), controller.bulkUpsertDrivers);
router.post('/', requireRole('Admin', 'Staff'), controller.createDriver);
router.put('/:id', requireRole('Admin', 'Staff'), controller.updateDriver);
router.delete('/:id', requireRole('Admin'), controller.deleteDriver);

module.exports = router;
