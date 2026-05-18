/**
 * admin.validator.js — Zod schemas for admin user-management endpoints.
 */

const { z } = require('zod');

const positiveIntFromParam = z.coerce
  .number({ invalid_type_error: 'ID utilisateur invalide' })
  .int('ID utilisateur invalide')
  .positive('ID utilisateur invalide');

const userIdParamSchema = z.object({ id: positiveIntFromParam });

const ROLES = ['participant', 'brand', 'quizmaster', 'admin'];

const getUsersQuerySchema = z.object({
  role: z.enum(ROLES).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.string().min(1).max(100).optional(),
  isBlocked: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => (typeof v === 'boolean' ? v : v === 'true'))
    .optional(),
});

module.exports = { userIdParamSchema, getUsersQuerySchema };
