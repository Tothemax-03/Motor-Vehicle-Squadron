const express = require('express');
const controller = require('../controllers/movementController');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();

router.get('/', requireAuth, controller.listMovements);
router.put('/bulk', requireRole('Admin', 'Staff'), controller.bulkUpsertMovements);
router.post('/', requireRole('Admin', 'Staff'), controller.createMovement);
router.put('/:id', requireRole('Admin', 'Staff'), controller.updateMovement);
router.delete('/:id', requireRole('Admin', 'Staff'), controller.deleteMovement);

module.exports = router;
