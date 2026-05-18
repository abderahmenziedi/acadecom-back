/**
 * participant.service.test.js — unit tests for ParticipantService.
 *
 * Covers the diagnostic bug-fixes:
 *   - B1: incremental + bulk-submit cannot coexist on the same attempt
 *   - B5: missing user throws 404 instead of TypeError
 *   - And the happy paths: start, answer, finish, submitAndFinish.
 */

jest.mock('../../src/config/prisma', () => require('../helpers/prismaMock').makePrismaMock());

jest.mock('../../src/services/gamification.service', () => ({
  processQuizCompletion: jest.fn(async (_userId, _attemptId, payload = {}) => ({
    xpEarned: payload.xpEarned ?? 10,
    couponsEarned: payload.couponsEarned ?? 1,
    passed: (payload.xpEarned ?? 10) > 0,
  })),
}));
jest.mock('../../src/services/notification.service', () => ({
  notifyParticipantQuizPlayed: jest.fn(async () => null),
  notifyQuizPlayed: jest.fn(async () => null),
  notifyQuizStatsMilestone: jest.fn(async () => null),
}));
jest.mock('../../src/services/activityLog.service', () => ({
  log: jest.fn(async () => null),
}));

const prisma = require('../../src/config/prisma');
const ParticipantService = require('../../src/services/participant.service');
const { resetPrismaMock } = require('../helpers/prismaMock');

beforeEach(() => {
  resetPrismaMock();
  prisma.$transaction.mockImplementation((arg) =>
    typeof arg === 'function' ? Promise.resolve(arg(prisma)) : Promise.all(arg),
  );
});

describe('getStats', () => {
  test('throws 404 when user does not exist (B5)', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(ParticipantService.getStats(123)).rejects.toMatchObject({ statusCode: 404 });
  });

  test('returns aggregates + rank', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ xp: 200 });
    prisma.$transaction.mockResolvedValueOnce([
      { _avg: { score: 80 }, _max: { score: 100 }, _sum: { score: 1000 } },
      5,
    ]);
    prisma.user.count.mockResolvedValueOnce(3);

    const stats = await ParticipantService.getStats(1);
    expect(stats).toEqual({
      gamesPlayed: 5,
      totalScore: 1000,
      averageScore: 80,
      bestScore: 100,
      totalXP: 200,
      rank: 4,
    });
  });
});

describe('startAttempt', () => {
  const quiz = {
    id: 1,
    isActive: true,
    title: 'Demo',
    description: '',
    timeLimit: 60,
    shuffleQuestions: false,
    maxAttempts: 0,
    xpReward: 10,
    couponReward: 0,
    passingScore: 50,
    questions: [
      { id: 1, text: 'Q1', points: 2, options: [{ id: 10, text: 'a' }] },
      { id: 2, text: 'Q2', points: 3, options: [{ id: 20, text: 'b' }] },
    ],
  };

  test('refuses inactive quizzes', async () => {
    prisma.quiz.findUnique.mockResolvedValueOnce({ ...quiz, isActive: false });
    await expect(ParticipantService.startAttempt(1, 1)).rejects.toMatchObject({ statusCode: 400 });
  });

  test('refuses replay when an active attempt already exists (quiz already used)', async () => {
    prisma.quiz.findUnique.mockResolvedValueOnce(quiz);
    prisma.attempt.count.mockResolvedValueOnce(1);

    await expect(ParticipantService.startAttempt(1, 1)).rejects.toMatchObject({
      statusCode: 409,
      message: 'Quiz already used, cannot retry',
    });
    expect(prisma.attempt.create).not.toHaveBeenCalled();
  });

  test('refuses new attempt when maxAttempts is reached', async () => {
    prisma.quiz.findUnique.mockResolvedValueOnce({ ...quiz, maxAttempts: 1 });
    prisma.attempt.count
      .mockResolvedValueOnce(0) // countForQuizUser
      .mockResolvedValueOnce(1); // countCompleted
    await expect(ParticipantService.startAttempt(1, 1)).rejects.toMatchObject({ statusCode: 409 });
  });

  test('refuses replay when participant already completed quiz once', async () => {
    prisma.quiz.findUnique.mockResolvedValueOnce({ ...quiz, maxAttempts: 0 });
    prisma.attempt.count.mockResolvedValueOnce(1);

    await expect(ParticipantService.startAttempt(1, 1)).rejects.toMatchObject({
      statusCode: 409,
      message: 'Quiz already used, cannot retry',
    });
  });

  test('happy path returns attempt + questions and computes maxScore', async () => {
    prisma.quiz.findUnique.mockResolvedValueOnce(quiz);
    prisma.attempt.count.mockResolvedValueOnce(0);
    prisma.attempt.create.mockResolvedValueOnce({
      id: 1,
      quizId: 1,
      maxScore: 5,
      createdAt: new Date(),
    });

    const result = await ParticipantService.startAttempt(1, 1);
    expect(result.attempt.maxScore).toBe(5);
    expect(result.questions).toHaveLength(2);
    expect(prisma.attempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { quizId: 1, userId: 1, maxScore: 5 },
      }),
    );
  });
});

describe('answer / finish flow vs. submitAndFinish (B1)', () => {
  test('submitAndFinish refuses when answers already exist on the attempt', async () => {
    prisma.attempt.findUnique.mockResolvedValueOnce({
      id: 1,
      userId: 1,
      completedAt: null,
      maxScore: 5,
      createdAt: new Date(),
      quizId: 1,
      answers: [],
      quiz: {
        title: 'Q',
        xpReward: 10,
        couponReward: 0,
        passingScore: 50,
        questions: [
          {
            id: 1,
            points: 2,
            options: [
              { id: 10, isCorrect: true },
              { id: 11, isCorrect: false },
            ],
          },
        ],
      },
    });
    prisma.answer.count.mockResolvedValueOnce(2);

    await expect(
      ParticipantService.submitAndFinish(1, 1, [{ questionId: 1, optionId: 10 }]),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  test('submitAndFinish persists answers and returns score', async () => {
    const createdAt = new Date(Date.now() - 10_000);
    prisma.attempt.findUnique.mockResolvedValueOnce({
      id: 1,
      userId: 1,
      completedAt: null,
      maxScore: 5,
      createdAt,
      quizId: 1,
      answers: [],
      quiz: {
        title: 'Q',
        xpReward: 10,
        couponReward: 0,
        passingScore: 50,
        questions: [
          {
            id: 1,
            points: 5,
            options: [
              { id: 10, isCorrect: true },
              { id: 11, isCorrect: false },
            ],
          },
        ],
      },
    });
    prisma.answer.count.mockResolvedValueOnce(0);
    prisma.answer.createMany.mockResolvedValueOnce({ count: 1 });
    prisma.attempt.update.mockResolvedValueOnce({
      id: 1,
      quizId: 1,
      score: 5,
      maxScore: 5,
      duration: 10,
      completedAt: new Date(),
      createdAt,
    });

    const result = await ParticipantService.submitAndFinish(1, 1, [
      { questionId: 1, optionId: 10 },
    ]);
    expect(result.pointsEarned).toBe(5);
    expect(result.correctAnswers).toBe(1);
    expect(result.percentage).toBe(100);
  });

  test('submitAndFinish computes coupons with standard rounding', async () => {
    const createdAt = new Date(Date.now() - 10_000);
    prisma.attempt.findUnique.mockResolvedValueOnce({
      id: 2,
      userId: 1,
      completedAt: null,
      maxScore: 10,
      createdAt,
      quizId: 2,
      answers: [],
      quiz: {
        title: 'Rounding quiz',
        xpReward: 10,
        couponReward: 5, // max coupons for the quiz
        passingScore: 50,
        questions: [
          {
            id: 101,
            points: 5,
            options: [
              { id: 1001, isCorrect: true },
              { id: 1002, isCorrect: false },
            ],
          },
          {
            id: 102,
            points: 5,
            options: [
              { id: 1003, isCorrect: true },
              { id: 1004, isCorrect: false },
            ],
          },
        ],
      },
    });
    prisma.answer.count.mockResolvedValueOnce(0);
    prisma.answer.createMany.mockResolvedValueOnce({ count: 2 });
    prisma.attempt.update.mockResolvedValueOnce({
      id: 2,
      quizId: 2,
      score: 5,
      maxScore: 10,
      duration: 10,
      completedAt: new Date(),
      createdAt,
    });

    const result = await ParticipantService.submitAndFinish(2, 1, [
      { questionId: 101, optionId: 1001 }, // correct
      { questionId: 102, optionId: 1004 }, // wrong
    ]);

    // ratio = (1/2) * 5 = 2.5 => Math.round => 3
    expect(result.couponsEarned).toBe(3);
    expect(result.totalQuestions).toBe(2);
    expect(result.correctAnswers).toBe(1);
  });

  test('answerQuestion forbids submitting another user’s attempt', async () => {
    prisma.attempt.findUnique.mockResolvedValueOnce({
      id: 1,
      userId: 999,
      completedAt: null,
      quizId: 1,
    });
    await expect(
      ParticipantService.answerQuestion(1, 1, { questionId: 1, optionId: 10 }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('getAttemptResult', () => {
  test('returns 400 when the attempt is not finished', async () => {
    prisma.attempt.findUnique.mockResolvedValueOnce({
      id: 1,
      userId: 1,
      quizId: 1,
      score: 0,
      maxScore: 5,
      completedAt: null,
      answers: [],
      quiz: { title: 'X', description: '' },
    });
    await expect(ParticipantService.getAttemptResult(1, 1)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  test('returns full breakdown when finished', async () => {
    prisma.attempt.findUnique.mockResolvedValueOnce({
      id: 1,
      userId: 1,
      quizId: 1,
      score: 5,
      maxScore: 5,
      duration: 30,
      completedAt: new Date(),
      createdAt: new Date(),
      quiz: { title: 'X', description: '' },
      answers: [
        {
          id: 1,
          questionId: 1,
          optionId: 10,
          isCorrect: true,
          question: { text: 'q', points: 5 },
          option: { text: 'a' },
        },
      ],
    });
    const result = await ParticipantService.getAttemptResult(1, 1);
    expect(result.percentage).toBe(100);
    expect(result.correctAnswers).toBe(1);
  });
});
