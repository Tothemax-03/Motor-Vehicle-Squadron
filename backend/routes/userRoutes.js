const express = require('express');
const controller = require('../controllers/userController');
const { requireAuth } = require('../middlewares/auth');
const { requireAdmin } = require('../middlewares/roleMiddleware');

const router = express.Router();

router.get('/', requireAuth, requireAdmin, controller.listUsers);
router.get('/me', requireAuth, requireAdmin, controller.getMyProfile);
router.post('/', requireAuth, requireAdmin, controller.createUser);
router.put('/:id', requireAuth, requireAdmin, controller.updateUser);
router.delete('/:id', requireAdmin, controller.deleteUser);

module.exports = router;
