/**
 * quiz.repository.js — data-access for the Quiz model (read-side primarily).
 *
 * Write operations live in `quiz.service.js` (Phase 2b refactor target).
 */

const prisma = require('../config/prisma');

const PUBLIC_LIST_SELECT = {
  id: true,
  title: true,
  description: true,
  timeLimit: true,
  pointsPerQuestion: true,
  maxAttempts: true,
  difficulty: true,
  category: true,
  imageUrl: true,
  createdAt: true,
  quizmaster: { select: { id: true, name: true, email: true } },
  _count: { select: { questions: true, attempts: true } },
};

const QuizRepository = {
  /**
   * Get a quiz with the participant-facing question shape (no correct flags).
   * @param {number} quizId
   */
  findForAttempt(quizId) {
    return prisma.quiz.findUnique({
      where: { id: quizId },
      select: {
        id: true,
        isActive: true,
        title: true,
        description: true,
        timeLimit: true,
        shuffleQuestions: true,
        maxAttempts: true,
        couponReward: true,
        questions: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            text: true,
            points: true,
            options: { select: { id: true, text: true } },
          },
        },
      },
    });
  },

  /**
   * Get a quiz with options' `isCorrect` for server-side scoring. Never send
   * this to a participant.
   * @param {number} quizId
   */
  findForScoring(quizId) {
    return prisma.quiz.findUnique({
      where: { id: quizId },
      select: {
        id: true,
        title: true,
        couponReward: true,
        questions: {
          select: {
            id: true,
            points: true,
            options: { select: { id: true, isCorrect: true } },
          },
        },
      },
    });
  },

  /** Paginate active quizzes for the public catalog. */
  async paginateAvailable({ skip, take, search }) {
    const where = { isActive: true, questions: { some: {} } };
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [items, total] = await prisma.$transaction([
      prisma.quiz.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: PUBLIC_LIST_SELECT,
      }),
      prisma.quiz.count({ where }),
    ]);

    return { items, total };
  },

  /**
   * Quizzes the participant has not yet completed, ranked by popularity.
   * @param {number}   userId
   * @param {number}   [take=10]
   */
  async listRecommendations(userId, take = 10) {
    const completed = await prisma.attempt.findMany({
      where: { userId, completedAt: { not: null } },
      select: { quizId: true },
      distinct: ['quizId'],
    });
    const excludeIds = completed.map((a) => a.quizId);

    return prisma.quiz.findMany({
      where: {
        isActive: true,
        questions: { some: {} },
        ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
      },
      orderBy: { attempts: { _count: 'desc' } },
      take,
      select: PUBLIC_LIST_SELECT,
    });
  },

  PUBLIC_LIST_SELECT,
};

module.exports = QuizRepository;
