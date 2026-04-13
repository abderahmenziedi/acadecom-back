const { z } = require("zod");

/**
 * Schémas de validation Zod pour les routes admin/quizmasters.
 */

const positiveIntSchema = z
    .coerce
    .number()
    .int("La valeur doit être un entier")
    .min(1, "La valeur doit être supérieure ou égale à 1")
    .max(2147483647, "La valeur dépasse la limite autorisée");

// Validation de l'ID quizmaster en paramètre d'URL (:id)
const quizmasterIdParamSchema = z.object({
    id: positiveIntSchema,
});

// Validation pour la création d'un quizmaster
const createQuizmasterSchema = z.object({
    name: z
        .string({ required_error: "Le nom est requis" })
        .min(2, "Le nom doit contenir au moins 2 caractères")
        .max(100, "Le nom ne peut pas dépasser 100 caractères")
        .trim(),
    email: z
        .string({ required_error: "L'email est requis" })
        .email("Format email invalide")
        .max(255, "L'email ne peut pas dépasser 255 caractères")
        .trim()
        .toLowerCase(),
    password: z
        .string({ required_error: "Le mot de passe est requis" })
        .min(6, "Le mot de passe doit contenir au moins 6 caractères")
        .max(128, "Le mot de passe ne peut pas dépasser 128 caractères"),
    brandId: z
        .number({ required_error: "Le brandId est requis" })
        .int("Le brandId doit être un entier")
        .positive("Le brandId doit être un nombre positif"),
});

// Validation pour la mise à jour d'un quizmaster (tous les champs optionnels)
const updateQuizmasterSchema = z.object({
    name: z
        .string()
        .min(2, "Le nom doit contenir au moins 2 caractères")
        .max(100, "Le nom ne peut pas dépasser 100 caractères")
        .trim()
        .optional(),
    email: z
        .string()
        .email("Format email invalide")
        .max(255, "L'email ne peut pas dépasser 255 caractères")
        .trim()
        .toLowerCase()
        .optional(),
    password: z
        .string()
        .min(6, "Le mot de passe doit contenir au moins 6 caractères")
        .max(128, "Le mot de passe ne peut pas dépasser 128 caractères")
        .optional(),
    brandId: z
        .number()
        .int("Le brandId doit être un entier")
        .positive("Le brandId doit être un nombre positif")
        .optional(),
}).refine(
    (data) => Object.keys(data).length > 0,
    { message: "Au moins un champ doit être fourni pour la mise à jour" }
);

// Validation des query params pour GET /api/v1/admin/quizmasters
const getQuizmastersQuerySchema = z.object({
    brandId: z.coerce.number().int("brandId doit être un entier").positive("brandId doit être positif").optional(),
    page: z.coerce.number().int("page doit être un entier").min(1, "page doit être >= 1").default(1),
    limit: z.coerce.number().int("limit doit être un entier").min(1, "limit doit être >= 1").max(100, "limit doit être <= 100").default(10),
});

module.exports = {
    quizmasterIdParamSchema,
    createQuizmasterSchema,
    updateQuizmasterSchema,
    getQuizmastersQuerySchema,
};
