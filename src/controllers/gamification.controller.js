const GamificationService = require("../services/gamification.service");

const GamificationController = {
  async getProfile(req, res, next) {
    try {
      const profile = await GamificationService.getProfile(req.user.id);
      res.json({ status: "success", data: { profile } });
    } catch (err) { next(err); }
  },

  async getAllBadges(req, res, next) {
    try {
      const badges = await GamificationService.getAllBadges(req.user.id);
      res.json({ status: "success", data: { badges } });
    } catch (err) { next(err); }
  },
};

module.exports = GamificationController;
