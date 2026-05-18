/**
 * answer.repository.js — write helpers for participant answers.
 */

const prisma = require('../config/prisma');

const AnswerRepository = {
  /**
   * Persist a single answer.
   * @param {object} args
   * @param {number} args.attemptId
   * @param {number} args.questionId
   * @param {number} args.optionId
   * @param {number} args.userId
   * @param {boolean} args.isCorrect
   */
  create({ attemptId, questionId, optionId, userId, isCorrect }) {
    return prisma.answer.create({
      data: { attemptId, questionId, optionId, isCorrect, userId },
      select: { id: true, questionId: true, optionId: true, isCorrect: true },
    });
  },

  /**
   * Persist many answers in one round-trip. Used by the bulk-submit endpoint.
   * @param {Array} records
   */
  createMany(records) {
    return prisma.answer.createMany({ data: records });
  },
};

module.exports = AnswerRepository;
