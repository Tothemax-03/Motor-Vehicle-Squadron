const express = require('express');
const controller = require('../controllers/userController');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();

router.get('/', requireAuth, controller.listUsers);
router.get('/me', requireAuth, controller.getMyProfile);
router.post('/', requireRole('Admin'), controller.createUser);
router.put('/:id', requireAuth, controller.updateUser);
router.delete('/:id', requireRole('Admin'), controller.deleteUser);

module.exports = router;
