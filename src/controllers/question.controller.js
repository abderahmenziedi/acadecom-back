const QuestionService = require("../services/question.service");
const { questionIdParamSchema, quizIdParamSchema } = require("../validations/question.validation");
const ApiError = require("../utils/ApiError");

function parseQuizId(params) {
    const result = quizIdParamSchema.safeParse(params);
    if (!result.success) {
        const fieldErrors = result.error.flatten().fieldErrors;
        throw new ApiError(400, fieldErrors.quizId?.[0] || "ID quiz invalide");
    }
    return result.data.quizId;
}

function parseQuestionId(params) {
    const result = questionIdParamSchema.safeParse(params);
    if (!result.success) {
        const fieldErrors = result.error.flatten().fieldErrors;
        throw new ApiError(400, fieldErrors.id?.[0] || "ID question invalide");
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
 * QuestionController — Couche contrôleur pour la gestion des questions.
 */
const QuestionController = {
    /**
     * POST /api/v1/quizmaster/quizzes/:quizId/questions
     */
    async create(req, res, next) {
        try {
            const quizmasterId = extractQuizmasterId(req);
            const quizId = parseQuizId(req.params);
            const question = await QuestionService.create(quizId, req.body, quizmasterId);

            res.status(201).json({
                status: "success",
                message: "Question ajoutée avec succès",
                data: { question },
            });
        } catch (err) {
            next(err);
        }
    },

    /**
     * PUT /api/v1/quizmaster/questions/:id
     */
    async update(req, res, next) {
        try {
            const quizmasterId = extractQuizmasterId(req);
            const questionId = parseQuestionId(req.params);
            const question = await QuestionService.update(questionId, req.body, quizmasterId);

            res.status(200).json({
                status: "success",
                message: "Question mise à jour avec succès",
                data: { question },
            });
        } catch (err) {
            next(err);
        }
    },

    /**
     * DELETE /api/v1/quizmaster/questions/:id
     */
    async delete(req, res, next) {
        try {
            const quizmasterId = extractQuizmasterId(req);
            const questionId = parseQuestionId(req.params);
            const deleted = await QuestionService.delete(questionId, quizmasterId);

            res.status(200).json({
                status: "success",
                message: "Question supprimée avec succès",
                data: { id: deleted.id },
            });
        } catch (err) {
            next(err);
        }
    },
};

module.exports = QuestionController;
