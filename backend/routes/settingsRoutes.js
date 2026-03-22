const express = require("express");
const controller = require("../controllers/settingsController");
const { requireAuth } = require("../middlewares/auth");
const { requireAdminOrStaff } = require("../middlewares/roleMiddleware");

const router = express.Router();

router.get("/", requireAuth, requireAdminOrStaff, controller.getSettings);
router.put("/", requireAuth, requireAdminOrStaff, controller.updateSettings);

module.exports = router;
