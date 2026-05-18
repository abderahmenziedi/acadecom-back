/**
 * leaderboard.validator.js — Zod schemas for leaderboard endpoints.
 *
 * The leaderboard module itself remains on the legacy pattern in Phase 2a;
 * we just lift its schemas into the new validators folder so it no longer
 * depends on the legacy `validations/participant.validation.js` file.
 */

const { z } = require('zod');

const leaderboardQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

module.exports = { leaderboardQuerySchema };
