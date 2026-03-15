const express = require('express');
const controller = require('../controllers/vehicleController');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();

router.get('/', requireAuth, controller.listVehicles);
router.put('/bulk', requireRole('Admin', 'Staff'), controller.bulkUpsertVehicles);
router.post('/', requireRole('Admin', 'Staff'), controller.createVehicle);
router.put('/:id', requireRole('Admin', 'Staff'), controller.updateVehicle);
router.delete('/:id', requireRole('Admin'), controller.deleteVehicle);

module.exports = router;
