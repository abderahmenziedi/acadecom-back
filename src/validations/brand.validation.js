const { z } = require("zod");

/**
 * Schémas de validation Zod pour les routes admin/brands et brand self-service.
 */

const positiveIntSchema = z
    .coerce
    .number()
    .int("La valeur doit être un entier")
    .min(1, "La valeur doit être supérieure ou égale à 1")
    .max(2147483647, "La valeur dépasse la limite autorisée");

// Validation de l'ID brand en paramètre d'URL (:id)
const brandIdParamSchema = z.object({
    id: positiveIntSchema,
});

// Validation pour la création d'un brand (admin)
const createBrandSchema = z.object({
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
    industry: z
        .string()
        .max(100, "Le secteur ne peut pas dépasser 100 caractères")
        .trim()
        .optional()
        .nullable(),
    description: z
        .string()
        .max(2000, "La description ne peut pas dépasser 2000 caractères")
        .trim()
        .optional()
        .nullable(),
});

// Validation pour la mise à jour d'un brand (admin — tous les champs)
const updateBrandSchema = z.object({
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
    industry: z
        .string()
        .max(100, "Le secteur ne peut pas dépasser 100 caractères")
        .trim()
        .optional()
        .nullable(),
    description: z
        .string()
        .max(2000, "La description ne peut pas dépasser 2000 caractères")
        .trim()
        .optional()
        .nullable(),
}).refine(
    (data) => Object.keys(data).length > 0,
    { message: "Au moins un champ doit être fourni pour la mise à jour" }
);

// Validation pour la mise à jour du profil brand (self — champs limités, pas d'email/password)
const updateBrandProfileSchema = z.object({
    name: z
        .string()
        .min(2, "Le nom doit contenir au moins 2 caractères")
        .max(100, "Le nom ne peut pas dépasser 100 caractères")
        .trim()
        .optional(),
    industry: z
        .string()
        .max(100, "Le secteur ne peut pas dépasser 100 caractères")
        .trim()
        .optional()
        .nullable(),
    description: z
        .string()
        .max(2000, "La description ne peut pas dépasser 2000 caractères")
        .trim()
        .optional()
        .nullable(),
}).refine(
    (data) => Object.keys(data).length > 0,
    { message: "Au moins un champ doit être fourni pour la mise à jour" }
);

// Validation des query params pour GET /api/v1/admin/brands
const getBrandsQuerySchema = z.object({
    page: z.coerce.number().int("page doit être un entier").min(1, "page doit être >= 1").default(1),
    limit: z.coerce.number().int("limit doit être un entier").min(1, "limit doit être >= 1").max(100, "limit doit être <= 100").default(10),
    industry: z.string().max(100).optional(),
    search: z.string().max(100).optional(),
});

module.exports = {
    brandIdParamSchema,
    createBrandSchema,
    updateBrandSchema,
    updateBrandProfileSchema,
    getBrandsQuerySchema,
};
