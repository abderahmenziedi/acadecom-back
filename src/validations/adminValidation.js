const { z } = require("zod");

/**
 * Schémas de validation Zod pour les routes admin.
 * Valide tous les inputs utilisateur avec des règles strictes.
 */

const roles = ["participant", "brand", "quizmaster", "admin"];

const positiveIntSchema = z
    .coerce
    .number()
    .int("La valeur doit être un entier")
    .min(1, "La valeur doit être supérieure ou égale à 1")
    .max(2147483647, "La valeur dépasse la limite autorisée");

// Validation stricte de l'ID utilisateur en paramètre d'URL (:id)
const userIdParamSchema = z.object({
    id: positiveIntSchema,
});

// Validation des query params pour GET /api/admin/users
const getUsersQuerySchema = z.object({
    role: z.enum(roles, {
        errorMap: () => ({
            message: "Le rôle doit être: participant, brand, quizmaster ou admin",
        }),
    }).optional(),
    page: z.coerce.number().int("page doit être un entier").min(1, "page doit être >= 1").default(1),
    limit: z.coerce.number().int("limit doit être un entier").min(1, "limit doit être >= 1").max(100, "limit doit être <= 100").default(10),
});

module.exports = { userIdParamSchema, getUsersQuerySchema };
