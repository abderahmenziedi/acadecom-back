/**
 * auth.validator.js — Zod schemas for authentication endpoints.
 *
 * Public registration accepts `participant`, `brand`, `quizmaster`. The
 * `admin` role is intentionally rejected; admins are created via the seed
 * or by an existing admin only.
 *
 * Quizmasters MUST select a `brandId`; other roles MUST NOT.
 */

const { z } = require('zod');

const REGISTRABLE_ROLES = ['participant', 'brand', 'quizmaster'];

const nameSchema = z
  .string({ required_error: 'Le nom est requis' })
  .min(2, 'Le nom doit contenir au moins 2 caractères')
  .max(100, 'Le nom ne peut pas dépasser 100 caractères')
  .trim();

const emailSchema = z
  .string({ required_error: "L'email est requis" })
  .email('Format email invalide')
  .toLowerCase()
  .trim();

const passwordSchema = z
  .string({ required_error: 'Le mot de passe est requis' })
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
  .max(100, 'Le mot de passe est trop long');

const registerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    role: z
      .enum(REGISTRABLE_ROLES, {
        errorMap: () => ({
          message: `Le rôle doit être l'un de : ${REGISTRABLE_ROLES.join(', ')}`,
        }),
      })
      .optional()
      .default('participant'),
    brandId: z.coerce.number().int().positive().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === 'quizmaster' && !data.brandId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['brandId'],
        message: 'Un quizmaster doit obligatoirement sélectionner une marque.',
      });
    }
    if (data.role !== 'quizmaster' && data.brandId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['brandId'],
        message: 'Seuls les quizmasters peuvent être rattachés à une marque.',
      });
    }
  });

const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ required_error: 'Le mot de passe est requis' })
    .min(1, 'Le mot de passe est requis'),
});

module.exports = { registerSchema, loginSchema, REGISTRABLE_ROLES };
