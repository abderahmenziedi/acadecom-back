const BrandControlService = require("../services/brandControl.service");
const ActivityLogService = require("../services/activityLog.service");
const ApiError = require("../utils/ApiError");

function parseId(raw, label = "ID") {
    const id = parseInt(raw, 10);
    if (!id || id <= 0) throw new ApiError(400, `${label} invalide`);
    return id;
}

const BrandControlController = {
    // ─── QuizMaster control ───────────────────────────────────

    async listQuizmasters(req, res, next) {
        try {
            const page = parseInt(req.query.page, 10) || 1;
            const limit = parseInt(req.query.limit, 10) || 20;
            const search = req.query.search || undefined;
            const data = await BrandControlService.listQuizmasters(req.user.id, { page, limit, search });
            res.json({ status: "success", data });
        } catch (err) { next(err); }
    },

    async blockQuizmaster(req, res, next) {
        try {
            const id = parseId(req.params.id, "Quizmaster ID");
            const user = await BrandControlService.blockQuizmaster(id, req.user.id);
            res.json({ status: "success", message: "Quizmaster bloqué", data: { user } });
        } catch (err) { next(err); }
    },

    async unblockQuizmaster(req, res, next) {
        try {
            const id = parseId(req.params.id, "Quizmaster ID");
            const user = await BrandControlService.unblockQuizmaster(id, req.user.id);
            res.json({ status: "success", message: "Quizmaster débloqué", data: { user } });
        } catch (err) { next(err); }
    },

    async deleteQuizmaster(req, res, next) {
        try {
            const id = parseId(req.params.id, "Quizmaster ID");
            const data = await BrandControlService.deleteQuizmaster(id, req.user.id);
            res.json({ status: "success", message: `Quizmaster ${data.email} supprimé`, data });
        } catch (err) { next(err); }
    },

    // ─── Quiz control ────────────────────────────────────────

    async listQuizzes(req, res, next) {
        try {
            const page = parseInt(req.query.page, 10) || 1;
            const limit = parseInt(req.query.limit, 10) || 20;
            const search = req.query.search || undefined;
            const isActive = req.query.isActive === "true"
                ? true
                : req.query.isActive === "false"
                    ? false
                    : undefined;
            const data = await BrandControlService.listQuizzes(req.user.id, { page, limit, search, isActive });
            res.json({ status: "success", data });
        } catch (err) { next(err); }
    },

    async enableQuiz(req, res, next) {
        try {
            const id = parseId(req.params.id, "Quiz ID");
            const quiz = await BrandControlService.enableQuiz(id, req.user.id);
            res.json({ status: "success", message: "Quiz activé", data: { quiz } });
        } catch (err) { next(err); }
    },

    async disableQuiz(req, res, next) {
        try {
            const id = parseId(req.params.id, "Quiz ID");
            const quiz = await BrandControlService.disableQuiz(id, req.user.id);
            res.json({ status: "success", message: "Quiz désactivé", data: { quiz } });
        } catch (err) { next(err); }
    },

    async deleteQuiz(req, res, next) {
        try {
            const id = parseId(req.params.id, "Quiz ID");
            await BrandControlService.deleteQuiz(id, req.user.id);
            res.json({ status: "success", message: "Quiz supprimé", data: { id } });
        } catch (err) { next(err); }
    },

    // ─── Participants ────────────────────────────────────────

    async listParticipants(req, res, next) {
        try {
            const page = parseInt(req.query.page, 10) || 1;
            const limit = parseInt(req.query.limit, 10) || 20;
            const data = await BrandControlService.listParticipants(req.user.id, { page, limit });
            res.json({ status: "success", data });
        } catch (err) { next(err); }
    },

    // ─── Stats ───────────────────────────────────────────────

    async getStats(req, res, next) {
        try {
            const data = await BrandControlService.getStats(req.user.id);
            res.json({ status: "success", data });
        } catch (err) { next(err); }
    },

    // ─── Activity log ─────────────────────────────────────────

    async getActivity(req, res, next) {
        try {
            const page = parseInt(req.query.page, 10) || 1;
            const limit = parseInt(req.query.limit, 10) || 20;
            const action = req.query.action || undefined;
            const data = await ActivityLogService.listForScope(req.user.id, { page, limit, action });
            res.json({ status: "success", data });
        } catch (err) { next(err); }
    },
};

module.exports = BrandControlController;
