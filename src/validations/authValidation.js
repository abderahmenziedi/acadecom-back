const { z } = require("zod");

/**
 * Rôles accessibles à l'inscription.
 * - participant: Utilisateur standard
 * - brand: Représentant de marque (peut avoir plusieurs quizmasters)
 * - quizmaster: Maître de quiz (doit sélectionner un utilisateur avec rôle "brand")
 * Note: admin n'est PAS autorisé à l'inscription (créé via seed uniquement)
 */
const allowedRolesAtRegister = ["participant", "brand", "quizmaster"];

const registerSchema = z.object({
    name: z
        .string({ required_error: "Le nom est requis" })
        .min(2, "Le nom doit contenir au moins 2 caractères")
        .max(100, "Le nom ne peut pas dépasser 100 caractères")
        .trim(),
    email: z.string({ required_error: "L'email est requis" }).email("Format email invalide"),
    password: z
        .string({ required_error: "Le mot de passe est requis" })
        .min(6, "Le mot de passe doit contenir au moins 6 caractères"),
    role: z
        .enum(allowedRolesAtRegister, {
            errorMap: () => ({ message: `Le rôle doit être l'un de : ${allowedRolesAtRegister.join(", ")}` }),
        })
        .optional()
        .default("participant"),
    brandId: z.number().int().positive("L'ID de la marque doit être un nombre positif").optional(),
}).refine(
    (data) => {
        // SEULEMENT les quizmasters peuvent avoir un brandId
        if (data.role !== "quizmaster" && data.brandId) {
            return false; // Erreur: brandId fourni pour un rôle qui n'est pas quizmaster
        }
        // Les quizmasters DOIVENT avoir un brandId
        if (data.role === "quizmaster" && !data.brandId) {
            return false; // Erreur: quizmaster sans brandId
        }
        return true;
    },
    {
        message: "Les quizmasters DOIVENT sélectionner une marque. Les autres rôles ne peuvent PAS avoir de brandId.",
        path: ["brandId"],
    }
);

const loginSchema = z.object({
    email: z.string({ required_error: "L'email est requis" }).email("Format email invalide"),
    password: z.string({ required_error: "Le mot de passe est requis" }).min(1, "Le mot de passe est requis"),
});

module.exports = { registerSchema, loginSchema };
