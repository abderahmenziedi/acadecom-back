/**
 * attempt.repository.js — data access for quiz attempts.
 *
 * The participant module is the primary consumer.
 */

const prisma = require('../config/prisma');

const LIST_SELECT = {
  id: true,
  quizId: true,
  score: true,
  maxScore: true,
  duration: true,
  completedAt: true,
  createdAt: true,
  quiz: { select: { title: true } },
};

const RESULT_SELECT = {
  id: true,
  userId: true,
  quizId: true,
  score: true,
  maxScore: true,
  duration: true,
  passed: true,
  xpEarned: true,
  couponsEarned: true,
  completedAt: true,
  createdAt: true,
  quiz: { select: { title: true, description: true } },
  answers: {
    select: {
      id: true,
      questionId: true,
      optionId: true,
      isCorrect: true,
      question: { select: { text: true, points: true } },
      option: { select: { text: true } },
    },
  },
};

const AttemptRepository = {
  /** Start a new attempt. */
  create(quizId, userId, maxScore) {
    return prisma.attempt.create({
      data: { quizId, userId, maxScore },
      select: { id: true, quizId: true, maxScore: true, createdAt: true },
    });
  },

  /** Find the active (unfinished) attempt for a (quiz, user) pair, if any. */
  findActive(quizId, userId) {
    return prisma.attempt.findFirst({
      where: { quizId, userId, completedAt: null },
      select: { id: true, quizId: true, userId: true, maxScore: true, createdAt: true },
    });
  },

  /** Count completed attempts for a (quiz, user) pair. */
  countCompleted(quizId, userId) {
    return prisma.attempt.count({
      where: { quizId, userId, completedAt: { not: null } },
    });
  },

  /** Count all attempts (active or completed) for a (quiz, user) pair. */
  countForQuizUser(quizId, userId) {
    return prisma.attempt.count({
      where: { quizId, userId },
    });
  },

  /** Load the data needed by the answer-question handler. */
  findForAnswering(attemptId) {
    return prisma.attempt.findUnique({
      where: { id: attemptId },
      select: { id: true, userId: true, completedAt: true, quizId: true },
    });
  },

  /** Number of existing answers on this attempt. */
  countAnswers(attemptId) {
    return prisma.answer.count({ where: { attemptId } });
  },

  /** Already-answered question ids. */
  existingAnswersFor(attemptId) {
    return prisma.answer.findMany({
      where: { attemptId },
      select: { questionId: true },
    });
  },

  /** Mark the attempt as completed (score + duration). */
  markFinished(attemptId, { score, duration, completedAt = new Date() }) {
    return prisma.attempt.update({
      where: { id: attemptId },
      data: { score, completedAt, duration },
      select: {
        id: true,
        quizId: true,
        score: true,
        maxScore: true,
        duration: true,
        completedAt: true,
        createdAt: true,
      },
    });
  },

  /** Patch gamification fields on the attempt (xp/coupons/passed). */
  patchGamification(attemptId, { passed, xpEarned, couponsEarned }) {
    return prisma.attempt.update({
      where: { id: attemptId },
      data: { passed, xpEarned, couponsEarned },
    });
  },

  /** Paginate finished attempts for a user. */
  async paginateForUser(userId, { skip, take }) {
    const where = { userId, completedAt: { not: null } };
    const [items, total] = await prisma.$transaction([
      prisma.attempt.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: LIST_SELECT,
      }),
      prisma.attempt.count({ where }),
    ]);
    return { items, total };
  },

  /** Result/detail view (includes answers + question/option text). */
  findResult(attemptId) {
    return prisma.attempt.findUnique({
      where: { id: attemptId },
      select: RESULT_SELECT,
    });
  },

  /** Aggregate stats used by the participant dashboard. */
  async aggregateForUser(userId) {
    const [aggregates, gamesPlayed] = await prisma.$transaction([
      prisma.attempt.aggregate({
        where: { userId, completedAt: { not: null } },
        _avg: { score: true },
        _max: { score: true },
        _sum: { score: true },
      }),
      prisma.attempt.count({ where: { userId, completedAt: { not: null } } }),
    ]);
    return {
      gamesPlayed,
      totalScore: aggregates._sum.score || 0,
      averageScore: Math.round(aggregates._avg.score || 0),
      bestScore: aggregates._max.score || 0,
    };
  },

  LIST_SELECT,
  RESULT_SELECT,
};

module.exports = AttemptRepository;
