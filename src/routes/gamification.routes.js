const express = require("express");
const router = express.Router();
const GamificationController = require("../controllers/gamification.controller");
const auth = require("../middlewares/auth");
const permit = require("../middlewares/role");

/**
 * Gamification Routes
 *
 * GET /profile     — XP, level, badges, progress
 * GET /badges      — All badges with earned status
 */

router.use(auth, permit("participant"));

router.get("/profile", GamificationController.getProfile);
router.get("/badges", GamificationController.getAllBadges);

module.exports = router;
