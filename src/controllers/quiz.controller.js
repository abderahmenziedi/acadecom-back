const QuizService = require("../services/quiz.service");
const { quizIdParamSchema, getQuizzesQuerySchema, submitAnswersSchema } = require("../validations/quiz.validation");
const ApiError = require("../utils/ApiError");
const prisma = require("../config/prisma");

/**
 * Extrait quizmasterId du JWT et récupère brandId depuis la DB (évite les données stale du token).
 */
async function extractQuizmasterInfo(req) {
    if (!req.user?.id) {
        throw new ApiError(401, "Quizmaster ID manquant dans le token JWT");
    }
    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { brandId: true, role: true },
    });
    if (!user || user.role !== "quizmaster") {
        throw new ApiError(403, "Accès réservé aux quizmasters");
    }
    if (!user.brandId) {
        throw new ApiError(403, "Ce quizmaster n'est pas lié à une brand");
    }
    return { quizmasterId: req.user.id, brandId: user.brandId };
}

function parseQuizId(params) {
    const result = quizIdParamSchema.safeParse(params);
    if (!result.success) {
        const fieldErrors = result.error.flatten().fieldErrors;
        throw new ApiError(400, fieldErrors.id?.[0] || "ID quiz invalide");
    }
    return result.data.id;
}

/**
 * QuizController — Couche contrôleur pour la gestion des quizzes.
 */
const QuizController = {
    /**
     * POST /api/v1/quizmaster/quizzes
     */
    async create(req, res, next) {
        try {
            const { quizmasterId, brandId } = await extractQuizmasterInfo(req);
            const quiz = await QuizService.create(req.body, quizmasterId, brandId);
            res.status(201).json({
                status: "success",
                message: "Quiz créé avec succès",
                data: { quiz },
            });
        } catch (err) {
            next(err);
        }
    },

    /**
     * GET /api/v1/quizmaster/quizzes
     */
    async getAll(req, res, next) {
        try {
            const { quizmasterId } = await extractQuizmasterInfo(req);

            const result = getQuizzesQuerySchema.safeParse(req.query);
            if (!result.success) {
                const fieldErrors = result.error.flatten().fieldErrors;
                const messages = Object.entries(fieldErrors)
                    .map(([field, errors]) => `${field}: ${errors[0]}`)
                    .join("; ");
                return next(new ApiError(400, messages || "Paramètres invalides"));
            }

            const data = await QuizService.getAll(quizmasterId, result.data);

            res.status(200).json({
                status: "success",
                message: `${data.total} quiz(zes) trouvé(s)`,
                data,
            });
        } catch (err) {
            next(err);
        }
    },

    /**
     * GET /api/v1/quizmaster/quizzes/:id
     */
    async getById(req, res, next) {
        try {
            const { quizmasterId } = await extractQuizmasterInfo(req);
            const quizId = parseQuizId(req.params);
            const quiz = await QuizService.getById(quizId, quizmasterId);

            res.status(200).json({
                status: "success",
                data: { quiz },
            });
        } catch (err) {
            next(err);
        }
    },

    /**
     * PUT /api/v1/quizmaster/quizzes/:id
     */
    async update(req, res, next) {
        try {
            const { quizmasterId } = await extractQuizmasterInfo(req);
            const quizId = parseQuizId(req.params);
            const quiz = await QuizService.update(quizId, req.body, quizmasterId);

            res.status(200).json({
                status: "success",
                message: "Quiz mis à jour avec succès",
                data: { quiz },
            });
        } catch (err) {
            next(err);
        }
    },

    /**
     * DELETE /api/v1/quizmaster/quizzes/:id
     */
    async delete(req, res, next) {
        try {
            const { quizmasterId } = await extractQuizmasterInfo(req);
            const quizId = parseQuizId(req.params);
            const deleted = await QuizService.delete(quizId, quizmasterId);

            res.status(200).json({
                status: "success",
                message: "Quiz supprimé avec succès",
                data: { id: deleted.id },
            });
        } catch (err) {
            next(err);
        }
    },

    /**
     * POST /api/v1/quizmaster/quizzes/:id/start
     * Démarre une tentative de quiz (participant).
     */
    async startAttempt(req, res, next) {
        try {
            const quizId = parseQuizId(req.params);
            const userId = req.user.id;
            const data = await QuizService.startAttempt(quizId, userId);

            res.status(201).json({
                status: "success",
                message: "Tentative démarrée",
                data,
            });
        } catch (err) {
            next(err);
        }
    },

    /**
     * POST /api/v1/quizmaster/quizzes/:id/submit
     * Soumet les réponses d'un participant.
     */
    async submitAnswers(req, res, next) {
        try {
            const attemptId = parseQuizId(req.params); // reuse same parser for :id
            const userId = req.user.id;
            const result = await QuizService.submitAnswers(attemptId, userId, req.body.answers);

            res.status(200).json({
                status: "success",
                message: "Réponses soumises avec succès",
                data: { result },
            });
        } catch (err) {
            next(err);
        }
    },
};

module.exports = QuizController;
