const { z } = require("zod");

/**
 * Schémas de validation Zod pour les routes quizmaster/questions.
 */

const positiveIntSchema = z
    .coerce
    .number()
    .int("La valeur doit être un entier")
    .min(1, "La valeur doit être supérieure ou égale à 1")
    .max(2147483647, "La valeur dépasse la limite autorisée");

// Validation ID paramètre d'URL
const questionIdParamSchema = z.object({
    id: positiveIntSchema,
});

const quizIdParamSchema = z.object({
    quizId: positiveIntSchema,
});

// Schéma d'une option lors de la création de question
const optionSchema = z.object({
    text: z
        .string({ required_error: "Le texte de l'option est requis" })
        .min(1, "Le texte de l'option ne peut pas être vide")
        .max(500, "Le texte de l'option ne peut pas dépasser 500 caractères")
        .trim(),
    isCorrect: z
        .boolean()
        .default(false),
});

// Validation pour la création d'une question (avec options)
const createQuestionSchema = z.object({
    text: z
        .string({ required_error: "Le texte de la question est requis" })
        .min(3, "Le texte doit contenir au moins 3 caractères")
        .max(2000, "Le texte ne peut pas dépasser 2000 caractères")
        .trim(),
    points: z
        .number()
        .int("Les points doivent être un entier")
        .min(1, "Les points doivent être >= 1")
        .max(100, "Les points ne peuvent pas dépasser 100")
        .default(1),
    order: z
        .number()
        .int("L'ordre doit être un entier")
        .min(0, "L'ordre doit être >= 0")
        .default(0),
    options: z
        .array(optionSchema, { required_error: "Les options sont requises" })
        .min(2, "Au moins 2 options sont requises")
        .max(6, "Maximum 6 options par question"),
}).refine(
    (data) => data.options.some((opt) => opt.isCorrect),
    { message: "Au moins une option doit être marquée comme correcte", path: ["options"] }
);

// Validation pour la mise à jour d'une question
const updateQuestionSchema = z.object({
    text: z
        .string()
        .min(3, "Le texte doit contenir au moins 3 caractères")
        .max(2000, "Le texte ne peut pas dépasser 2000 caractères")
        .trim()
        .optional(),
    points: z
        .number()
        .int("Les points doivent être un entier")
        .min(1, "Les points doivent être >= 1")
        .max(100, "Les points ne peuvent pas dépasser 100")
        .optional(),
    order: z
        .number()
        .int("L'ordre doit être un entier")
        .min(0, "L'ordre doit être >= 0")
        .optional(),
    options: z
        .array(optionSchema)
        .min(2, "Au moins 2 options sont requises")
        .max(6, "Maximum 6 options par question")
        .optional(),
}).refine(
    (data) => Object.keys(data).length > 0,
    { message: "Au moins un champ doit être fourni pour la mise à jour" }
).refine(
    (data) => {
        if (data.options) {
            return data.options.some((opt) => opt.isCorrect);
        }
        return true;
    },
    { message: "Au moins une option doit être marquée comme correcte", path: ["options"] }
);

module.exports = {
    questionIdParamSchema,
    quizIdParamSchema,
    createQuestionSchema,
    updateQuestionSchema,
};
