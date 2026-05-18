/**
 * participant.validator.js — Zod schemas for the participant module.
 *
 * Centralises the schemas for params (quizId, attemptId, id), query
 * pagination, and the two answer-submission shapes (single + batch).
 */

const { z } = require('zod');

const positiveInt = z.coerce
  .number({ invalid_type_error: 'Entier positif requis' })
  .int('Entier positif requis')
  .positive('Entier positif requis')
  .max(2_147_483_647, 'Valeur trop grande');

const quizIdParamSchema = z.object({ quizId: positiveInt });
const attemptIdParamSchema = z.object({ attemptId: positiveInt });
const idParamSchema = z.object({ id: positiveInt });

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const availableQuizzesQuerySchema = paginationQuerySchema.extend({
  search: z.string().max(100).trim().optional(),
});

const updateProfileSchema = z
  .object({
    name: z.string().min(2).max(100).trim().optional(),
    email: z.string().email('Email invalide').max(255).trim().toLowerCase().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Au moins un champ doit être fourni',
  });

const answerQuestionSchema = z.object({
  questionId: positiveInt,
  optionId: positiveInt,
});

const submitAnswersSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: positiveInt,
        optionId: positiveInt,
      }),
      { required_error: 'Les réponses sont requises' },
    )
    .min(1, 'Au moins une réponse est requise'),
});

module.exports = {
  quizIdParamSchema,
  attemptIdParamSchema,
  idParamSchema,
  paginationQuerySchema,
  availableQuizzesQuerySchema,
  updateProfileSchema,
  answerQuestionSchema,
  submitAnswersSchema,
};
