/**
 * validators.test.js — verifies the Zod schemas reject the most common bad
 * inputs and accept the well-shaped ones.
 */

const { registerSchema, loginSchema } = require('../../src/validators/auth.validator');
const {
  getUsersQuerySchema,
  userIdParamSchema,
} = require('../../src/validators/admin.validator');
const {
  submitAnswersSchema,
  answerQuestionSchema,
} = require('../../src/validators/participant.validator');

describe('auth.validator', () => {
  test('registerSchema rejects short passwords', () => {
    const r = registerSchema.safeParse({
      name: 'Yasmine',
      email: 'y@x.io',
      password: 'tiny',
    });
    expect(r.success).toBe(false);
  });

  test('registerSchema rejects a quizmaster without brandId', () => {
    const r = registerSchema.safeParse({
      name: 'Q',
      email: 'q@x.io',
      password: 'goodpassword',
      role: 'quizmaster',
    });
    expect(r.success).toBe(false);
  });

  test('registerSchema rejects a participant with a brandId', () => {
    const r = registerSchema.safeParse({
      name: 'P',
      email: 'p@x.io',
      password: 'goodpassword',
      role: 'participant',
      brandId: 5,
    });
    expect(r.success).toBe(false);
  });

  test('loginSchema lowercases the email', () => {
    const r = loginSchema.safeParse({ email: 'X@Y.IO', password: 'p' });
    expect(r.success).toBe(true);
    expect(r.data.email).toBe('x@y.io');
  });
});

describe('admin.validator', () => {
  test('userIdParamSchema coerces strings', () => {
    const r = userIdParamSchema.safeParse({ id: '42' });
    expect(r.success).toBe(true);
    expect(r.data.id).toBe(42);
  });

  test('getUsersQuerySchema clamps the limit', () => {
    const r = getUsersQuerySchema.safeParse({ limit: '5000' });
    expect(r.success).toBe(false);
  });

  test('getUsersQuerySchema parses isBlocked from a string', () => {
    const r = getUsersQuerySchema.safeParse({ isBlocked: 'true' });
    expect(r.success).toBe(true);
    expect(r.data.isBlocked).toBe(true);
  });
});

describe('participant.validator', () => {
  test('submitAnswersSchema requires at least one answer', () => {
    const r = submitAnswersSchema.safeParse({ answers: [] });
    expect(r.success).toBe(false);
  });

  test('answerQuestionSchema enforces positive ints', () => {
    expect(answerQuestionSchema.safeParse({ questionId: 0, optionId: 1 }).success).toBe(false);
    expect(answerQuestionSchema.safeParse({ questionId: 1, optionId: -1 }).success).toBe(false);
    expect(answerQuestionSchema.safeParse({ questionId: 1, optionId: 1 }).success).toBe(true);
  });
});
