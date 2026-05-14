const { z } = require("zod");

const trimmedString = (min, max, msg) =>
    z.string().trim().min(min, msg).max(max);

const updateMeSchema = z
    .object({
        name: trimmedString(2, 100, "Le nom doit contenir au moins 2 caractères").optional(),
        phone: z.string().trim().max(40).optional().nullable(),
        bio: z.string().trim().max(2000).optional().nullable(),
        address: z.string().trim().max(255).optional().nullable(),
        website: z.string().trim().max(255).optional().nullable(),
        industry: z.string().trim().max(100).optional().nullable(),
        description: z.string().trim().max(2000).optional().nullable(),
        avatar: z.string().trim().max(500).optional().nullable(),
        socialLinks: z
            .object({
                facebook: z.string().trim().max(255).optional().nullable(),
                twitter: z.string().trim().max(255).optional().nullable(),
                instagram: z.string().trim().max(255).optional().nullable(),
                linkedin: z.string().trim().max(255).optional().nullable(),
            })
            .optional()
            .nullable(),
    })
    .refine((d) => Object.keys(d).length > 0, {
        message: "Au moins un champ doit être fourni",
    });

const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, "Mot de passe actuel requis"),
    newPassword: z.string().min(6, "Le nouveau mot de passe doit contenir au moins 6 caractères").max(128),
});

const changeAvatarSchema = z.object({
    url: z.string().trim().max(500).nullable(),
});

module.exports = { updateMeSchema, changePasswordSchema, changeAvatarSchema };
