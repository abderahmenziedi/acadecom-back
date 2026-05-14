const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const ActivityLogService = require("../services/activityLog.service");

/**
 * Activity log — own actions of the authenticated user.
 * For brand-scoped activity (covering quizmasters & participants), see /api/v1/brand/activity.
 *
 * GET /api/v1/activity/me — actor's own activity timeline
 */
router.use(auth);

router.get("/me", async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const data = await ActivityLogService.listForActor(req.user.id, { page, limit });
        res.json({ status: "success", data });
    } catch (err) { next(err); }
});

module.exports = router;
