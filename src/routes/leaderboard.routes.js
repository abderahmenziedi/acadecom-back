const express = require("express");
const router = express.Router();
const LeaderboardController = require("../controllers/leaderboard.controller");
const auth = require("../middlewares/auth");
const permit = require("../middlewares/role");

/**
 * Routes Leaderboard — Classements.
 * Protégées par `auth` (JWT) + accessible à tous les rôles authentifiés.
 *
 * GET /api/v1/leaderboard/global           — Classement global
 * GET /api/v1/leaderboard/quiz/:quizId     — Classement par quiz
 */

router.use(auth, permit("participant", "brand", "quizmaster", "admin"));

router.get("/global", LeaderboardController.getGlobal);
router.get("/quiz/:quizId", LeaderboardController.getByQuiz);

module.exports = router;
