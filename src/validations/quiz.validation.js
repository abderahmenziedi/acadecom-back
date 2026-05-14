const { z } = require("zod");

/**
 * Schémas de validation Zod pour les routes quizmaster/quizzes.
 */

const positiveIntSchema = z
    .coerce
    .number()
    .int("La valeur doit être un entier")
    .min(1, "La valeur doit être supérieure ou égale à 1")
    .max(2147483647, "La valeur dépasse la limite autorisée");

// Validation de l'ID quiz en paramètre d'URL (:id)
const quizIdParamSchema = z.object({
    id: positiveIntSchema,
});

const imagePathSchema = z
    .string()
    .max(500, "URL trop longue")
    .trim()
    .optional()
    .nullable();

const difficultySchema = z.enum(["easy", "medium", "hard"]).optional();

// Validation pour la création d'un quiz
const createQuizSchema = z.object({
    title: z
        .string({ required_error: "Le titre est requis" })
        .min(3, "Le titre doit contenir au moins 3 caractères")
        .max(255, "Le titre ne peut pas dépasser 255 caractères")
        .trim(),
    description: z
        .string()
        .max(2000, "La description ne peut pas dépasser 2000 caractères")
        .trim()
        .optional()
        .nullable(),
    timeLimit: z
        .number()
        .int("Le temps limite doit être un entier")
        .min(10, "Le temps limite doit être d'au moins 10 secondes")
        .max(7200, "Le temps limite ne peut pas dépasser 7200 secondes (2h)")
        .optional()
        .nullable(),
    pointsPerQuestion: z
        .number()
        .int("Les points doivent être un entier")
        .min(1, "Les points doivent être >= 1")
        .max(100, "Les points ne peuvent pas dépasser 100")
        .default(1),
    shuffleQuestions: z
        .boolean()
        .default(false),
    imageUrl: imagePathSchema,
    category: z.string().max(100).trim().optional().nullable(),
    difficulty: difficultySchema,
    passingScore: z.number().int().min(0).max(100).optional(),
    xpReward: z.number().int().min(0).max(1000).optional(),
    couponReward: z.number().int().min(0).max(1000).optional(),
});

// Validation pour la mise à jour d'un quiz
const updateQuizSchema = z.object({
    title: z
        .string()
        .min(3, "Le titre doit contenir au moins 3 caractères")
        .max(255, "Le titre ne peut pas dépasser 255 caractères")
        .trim()
        .optional(),
    description: z
        .string()
        .max(2000, "La description ne peut pas dépasser 2000 caractères")
        .trim()
        .optional()
        .nullable(),
    timeLimit: z
        .number()
        .int("Le temps limite doit être un entier")
        .min(10, "Le temps limite doit être d'au moins 10 secondes")
        .max(7200, "Le temps limite ne peut pas dépasser 7200 secondes (2h)")
        .optional()
        .nullable(),
    pointsPerQuestion: z
        .number()
        .int("Les points doivent être un entier")
        .min(1, "Les points doivent être >= 1")
        .max(100, "Les points ne peuvent pas dépasser 100")
        .optional(),
    shuffleQuestions: z
        .boolean()
        .optional(),
    isActive: z
        .boolean()
        .optional(),
    imageUrl: imagePathSchema,
    category: z.string().max(100).trim().optional().nullable(),
    difficulty: difficultySchema,
    passingScore: z.number().int().min(0).max(100).optional(),
    xpReward: z.number().int().min(0).max(1000).optional(),
    couponReward: z.number().int().min(0).max(1000).optional(),
}).refine(
    (data) => Object.keys(data).length > 0,
    { message: "Au moins un champ doit être fourni pour la mise à jour" }
);

// Validation des query params pour GET /quizzes
const getQuizzesQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    isActive: z.enum(["true", "false"]).optional().transform(v => v === "true" ? true : v === "false" ? false : undefined),
});

// Validation pour soumettre des réponses (participant)
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

module.exports = {
    quizIdParamSchema,
    createQuizSchema,
    updateQuizSchema,
    getQuizzesQuerySchema,
    submitAnswersSchema,
};
