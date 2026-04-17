const LeaderboardService = require("../services/leaderboard.service");
const ApiError = require("../utils/ApiError");
const {
    leaderboardQuerySchema,
    quizLeaderboardParamSchema,
} = require("../validations/participant.validation");

function parseParam(schema, params) {
    const result = schema.safeParse(params);
    if (!result.success) {
        const msgs = Object.values(result.error.flatten().fieldErrors).flat();
        throw new ApiError(400, msgs[0] || "Paramètre invalide");
    }
    return result.data;
}

function parseQuery(schema, query) {
    const result = schema.safeParse(query);
    if (!result.success) {
        const msgs = Object.values(result.error.flatten().fieldErrors).flat();
        throw new ApiError(400, msgs[0] || "Paramètres invalides");
    }
    return result.data;
}

/**
 * LeaderboardController — Classements.
 */
const LeaderboardController = {
    async getGlobal(req, res, next) {
        try {
            const filters = parseQuery(leaderboardQuerySchema, req.query);
            const data = await LeaderboardService.getGlobal(filters);
            res.status(200).json({ status: "success", data });
        } catch (err) { next(err); }
    },

    async getWeekly(req, res, next) {
        try {
            const filters = parseQuery(leaderboardQuerySchema, req.query);
            const data = await LeaderboardService.getWeekly(filters);
            res.status(200).json({ status: "success", data });
        } catch (err) { next(err); }
    },

    async getMonthly(req, res, next) {
        try {
            const filters = parseQuery(leaderboardQuerySchema, req.query);
            const data = await LeaderboardService.getMonthly(filters);
            res.status(200).json({ status: "success", data });
        } catch (err) { next(err); }
    },

    async getByQuiz(req, res, next) {
        try {
            const { quizId } = parseParam(quizLeaderboardParamSchema, req.params);
            const filters = parseQuery(leaderboardQuerySchema, req.query);
            const data = await LeaderboardService.getByQuiz(quizId, filters);
            res.status(200).json({ status: "success", data });
        } catch (err) { next(err); }
    },
};

module.exports = LeaderboardController;
