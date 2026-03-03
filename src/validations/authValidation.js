const { z } = require("zod");

/**
 * Rôles accessibles à l'inscription (ADMIN ne peut pas être auto-assigné).
 * Un administrateur doit être créé manuellement en base ou par un autre admin.
 */
const allowedRolesAtRegister = ["USER", "VISITEUR", "BRAND"];

const registerSchema = z.object({
    email: z.string({ required_error: "L'email est requis" }).email("Format email invalide"),
    password: z
        .string({ required_error: "Le mot de passe est requis" })
        .min(6, "Le mot de passe doit contenir au moins 6 caractères"),
    role: z
        .enum(allowedRolesAtRegister, {
            errorMap: () => ({ message: `Le rôle doit être l'un de : ${allowedRolesAtRegister.join(", ")}` }),
        })
        .optional()
        .default("VISITEUR"),
});

const loginSchema = z.object({
    email: z.string({ required_error: "L'email est requis" }).email("Format email invalide"),
    password: z.string({ required_error: "Le mot de passe est requis" }).min(1, "Le mot de passe est requis"),
});

module.exports = { registerSchema, loginSchema };
