const ParticipantService = require("../services/participant.service");
const ApiError = require("../utils/ApiError");
const {
    quizIdParamSchema,
    attemptIdParamSchema,
    idParamSchema,
    availableQuizzesQuerySchema,
    attemptsQuerySchema,
    pointsHistoryQuerySchema,
} = require("../validations/participant.validation");

/**
 * Helpers — parse et valide les paramètres d'URL / query.
 */
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
        throw new ApiError(400, msgs[0] || "Paramètres de requête invalides");
    }
    return result.data;
}

/**
 * ParticipantController — Couche contrôleur du module Participant.
 */
const ParticipantController = {

    // ─── Profil ──────────────────────────────────────────────────

    async getProfile(req, res, next) {
        try {
            const profile = await ParticipantService.getProfile(req.user.id);
            res.status(200).json({ status: "success", data: { profile } });
        } catch (err) { next(err); }
    },

    async updateProfile(req, res, next) {
        try {
            const profile = await ParticipantService.updateProfile(req.user.id, req.body);
            res.status(200).json({ status: "success", message: "Profil mis à jour", data: { profile } });
        } catch (err) { next(err); }
    },

    async getStats(req, res, next) {
        try {
            const stats = await ParticipantService.getStats(req.user.id);
            res.status(200).json({ status: "success", data: { stats } });
        } catch (err) { next(err); }
    },

    // ─── Quiz disponibles ────────────────────────────────────────

    async listAvailableQuizzes(req, res, next) {
        try {
            const filters = parseQuery(availableQuizzesQuerySchema, req.query);
            const data = await ParticipantService.listAvailableQuizzes(filters);
            res.status(200).json({ status: "success", message: `${data.total} quiz(zes) disponible(s)`, data });
        } catch (err) { next(err); }
    },

    // ─── Participation ───────────────────────────────────────────

    async startAttempt(req, res, next) {
        try {
            const { quizId } = parseParam(quizIdParamSchema, req.params);
            const data = await ParticipantService.startAttempt(quizId, req.user.id);
            res.status(201).json({ status: "success", message: "Tentative démarrée", data });
        } catch (err) { next(err); }
    },

    async answerQuestion(req, res, next) {
        try {
            const { attemptId } = parseParam(attemptIdParamSchema, req.params);
            const answer = await ParticipantService.answerQuestion(attemptId, req.user.id, req.body);
            res.status(201).json({ status: "success", message: "Réponse enregistrée", data: { answer } });
        } catch (err) { next(err); }
    },

    async finishAttempt(req, res, next) {
        try {
            const { attemptId } = parseParam(attemptIdParamSchema, req.params);
            const result = await ParticipantService.finishAttempt(attemptId, req.user.id);
            res.status(200).json({ status: "success", message: "Tentative terminée", data: { result } });
        } catch (err) { next(err); }
    },

    async submitAndFinish(req, res, next) {
        try {
            const { attemptId } = parseParam(attemptIdParamSchema, req.params);
            const result = await ParticipantService.submitAndFinish(attemptId, req.user.id, req.body.answers);
            res.status(200).json({ status: "success", message: "Réponses soumises avec succès", data: { result } });
        } catch (err) { next(err); }
    },

    // ─── Résultat ────────────────────────────────────────────────

    async getAttemptResult(req, res, next) {
        try {
            const { attemptId } = parseParam(attemptIdParamSchema, req.params);
            const result = await ParticipantService.getAttemptResult(attemptId, req.user.id);
            res.status(200).json({ status: "success", data: { result } });
        } catch (err) { next(err); }
    },

    // ─── Historique ──────────────────────────────────────────────

    async getAttempts(req, res, next) {
        try {
            const filters = parseQuery(attemptsQuerySchema, req.query);
            const data = await ParticipantService.getAttempts(req.user.id, filters);
            res.status(200).json({ status: "success", message: `${data.total} tentative(s)`, data });
        } catch (err) { next(err); }
    },

    async getAttemptDetail(req, res, next) {
        try {
            const { id } = parseParam(idParamSchema, req.params);
            const attempt = await ParticipantService.getAttemptDetail(id, req.user.id);
            res.status(200).json({ status: "success", data: { attempt } });
        } catch (err) { next(err); }
    },

    // ─── Wallet / Points ─────────────────────────────────────────

    async getWallet(req, res, next) {
        try {
            const wallet = await ParticipantService.getWallet(req.user.id);
            res.status(200).json({ status: "success", data: { wallet } });
        } catch (err) { next(err); }
    },

    async getPointsHistory(req, res, next) {
        try {
            const filters = parseQuery(pointsHistoryQuerySchema, req.query);
            const data = await ParticipantService.getPointsHistory(req.user.id, filters);
            res.status(200).json({ status: "success", data });
        } catch (err) { next(err); }
    },

    // ─── Recommandations ─────────────────────────────────────────

    async getRecommendations(req, res, next) {
        try {
            const quizzes = await ParticipantService.getRecommendations(req.user.id);
            res.status(200).json({ status: "success", data: { recommendations: quizzes } });
        } catch (err) { next(err); }
    },
};

module.exports = ParticipantController;
