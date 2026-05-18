const express = require("express");
const router = express.Router();
const LeaderboardController = require("../controllers/leaderboard.controller");

router.get("/", LeaderboardController.getLeaderboard);

module.exports = router;
