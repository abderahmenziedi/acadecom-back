const AnalyticsService = require("../services/analytics.service");
const { quizIdParamSchema } = require("../validations/quiz.validation");
const ApiError = require("../utils/ApiError");

function parseQuizId(params) {
    const result = quizIdParamSchema.safeParse(params);
    if (!result.success) {
        const fieldErrors = result.error.flatten().fieldErrors;
        throw new ApiError(400, fieldErrors.id?.[0] || "ID quiz invalide");
    }
    return result.data.id;
}

function extractQuizmasterId(req) {
    if (!req.user?.id) {
        throw new ApiError(401, "Quizmaster ID manquant dans le token JWT");
    }
    return req.user.id;
}

/**
 * AnalyticsController — Couche contrôleur pour les analytics du quizmaster.
 */
const AnalyticsController = {
    /**
     * GET /api/v1/quizmaster/quizzes/:id/analytics
     */
    async getQuizAnalytics(req, res, next) {
        try {
            const quizmasterId = extractQuizmasterId(req);
            const quizId = parseQuizId(req.params);
            const analytics = await AnalyticsService.getQuizAnalytics(quizId, quizmasterId);

            res.status(200).json({
                status: "success",
                data: { analytics },
            });
        } catch (err) {
            next(err);
        }
    },

    /**
     * GET /api/v1/quizmaster/dashboard
     */
    async getDashboard(req, res, next) {
        try {
            const quizmasterId = extractQuizmasterId(req);
            const dashboard = await AnalyticsService.getDashboard(quizmasterId);

            res.status(200).json({
                status: "success",
                data: { dashboard },
            });
        } catch (err) {
            next(err);
        }
    },
};

module.exports = AnalyticsController;
