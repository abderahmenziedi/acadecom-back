const { z } = require("zod");

/**
 * Schémas de validation Zod pour le module Participant.
 */

const positiveIntSchema = z
    .coerce
    .number()
    .int("La valeur doit être un entier")
    .min(1, "La valeur doit être supérieure ou égale à 1")
    .max(2147483647, "La valeur dépasse la limite autorisée");

// ─── Paramètres d'URL ──────────────────────────────────────────────────────────

const quizIdParamSchema = z.object({
    quizId: positiveIntSchema,
});

const attemptIdParamSchema = z.object({
    attemptId: positiveIntSchema,
});

const idParamSchema = z.object({
    id: positiveIntSchema,
});

// ─── Profil ────────────────────────────────────────────────────────────────────

const updateProfileSchema = z.object({
    name: z
        .string()
        .min(2, "Le nom doit contenir au moins 2 caractères")
        .max(100, "Le nom ne peut pas dépasser 100 caractères")
        .trim()
        .optional(),
    email: z
        .string()
        .email("Email invalide")
        .max(255, "L'email ne peut pas dépasser 255 caractères")
        .trim()
        .toLowerCase()
        .optional(),
}).refine(
    (data) => Object.keys(data).length > 0,
    { message: "Au moins un champ doit être fourni pour la mise à jour" }
);

// ─── Quiz disponibles ──────────────────────────────────────────────────────────

const availableQuizzesQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().max(100).trim().optional(),
});

// ─── Répondre à une question ───────────────────────────────────────────────────

const answerQuestionSchema = z.object({
    questionId: z.number().int().positive("questionId invalide"),
    optionId: z.number().int().positive("optionId invalide"),
});

// ─── Soumettre toutes les réponses (batch) ─────────────────────────────────────

const submitAnswersSchema = z.object({
    answers: z
        .array(
            z.object({
                questionId: z.number().int().positive("questionId invalide"),
                optionId: z.number().int().positive("optionId invalide"),
            }),
            { required_error: "Les réponses sont requises" }
        )
        .min(1, "Au moins une réponse est requise"),
});

// ─── Historique / pagination ───────────────────────────────────────────────────

const attemptsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
});

const pointsHistoryQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
});

// ─── Leaderboard ───────────────────────────────────────────────────────────────

const leaderboardQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

const quizLeaderboardParamSchema = z.object({
    quizId: positiveIntSchema,
});

module.exports = {
    quizIdParamSchema,
    attemptIdParamSchema,
    idParamSchema,
    updateProfileSchema,
    availableQuizzesQuerySchema,
    answerQuestionSchema,
    submitAnswersSchema,
    attemptsQuerySchema,
    pointsHistoryQuerySchema,
    leaderboardQuerySchema,
    quizLeaderboardParamSchema,
};
