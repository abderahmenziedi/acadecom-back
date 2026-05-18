const LeaderboardService = require("../services/leaderboard.service");
const asyncHandler = require("../utils/asyncHandler");

const getLeaderboard = asyncHandler(async (_req, res) => {
  const data = await LeaderboardService.top20();
  res.json({ status: "success", data });
});

module.exports = { getLeaderboard };
