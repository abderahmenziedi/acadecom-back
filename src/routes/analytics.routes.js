const express = require("express");
const router = express.Router();
const AnalyticsController = require("../controllers/analytics.controller");
const auth = require("../middlewares/auth");
const permit = require("../middlewares/role");

/**
 * Routes Quizmaster — Dashboard analytics.
 * Protégées par `auth` (JWT) + `permit("quizmaster")` (RBAC).
 *
 * GET /api/v1/quizmaster/dashboard — Dashboard global du quizmaster
 */

router.use(auth, permit("quizmaster"));

router.get("/", AnalyticsController.getDashboard);

module.exports = router;
