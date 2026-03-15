const express = require('express');
const controller = require('../controllers/authController');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.post('/signup', controller.signup);
router.post('/login', controller.login);
router.post('/logout', requireAuth, controller.logout);
router.get('/me', controller.me);

module.exports = router;
