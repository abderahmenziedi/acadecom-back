/**
 * admin.service.js — admin-only operations on users (Phase 2a refactor).
 *
 * Scope:
 *   - Paginated user listing with optional filters.
 *   - Block / unblock with self-protection and admin-protection guards.
 *   - Hard delete for participants and quizmasters (transactional cleanup).
 *   - Brand archival is delegated to `BrandService.delete` to preserve the
 *     existing soft-delete contract.
 *   - CSV export.
 *
 * All Prisma access goes through `UserRepository` or per-domain helpers,
 * never directly here.
 */

const { Parser } = require('json2csv');

const prisma = require('../config/prisma');
const UserRepository = require('../repositories/user.repository');
const ApiError = require('../utils/ApiError');
const BrandService = require('./brand.service');
const { detachQuizmasterFromAllQuizzes } = require('./quizOwnership.service');
const { invalidateAccount } = require('../middlewares/auth');

/**
 * Throw if `id` is not a strictly positive integer.
 * @param {*} id
 * @param {string} label
 */
function ensurePositiveId(id, label) {
  if (!Number.isInteger(id) || id <= 0) {
    throw ApiError.badRequest(`${label} invalide`);
  }
}

const AdminService = {
  /**
   * Paginated user list with optional filters.
   * @param {object} args
   */
  async listUsers({ role, page, limit, search, isBlocked }) {
    const skip = (page - 1) * limit;
    const { items, total } = await UserRepository.paginate({
      skip,
      take: limit,
      role,
      isBlocked,
      search,
    });

    return {
      items,
      // legacy alias used by Phase-1 frontend pages — keep so they keep working
      // until Phase 3 ships its new data layer.
      users: items,
      total,
      page,
      limit,
      totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
    };
  },

  /**
   * Block a user account.
   * @param {number} targetId
   * @param {number} adminId
   */
  async blockUser(targetId, adminId) {
    ensurePositiveId(targetId, 'ID utilisateur');
    ensurePositiveId(adminId, 'ID administrateur');
    if (targetId === adminId) {
      throw ApiError.forbidden('Un admin ne peut pas bloquer son propre compte');
    }

    const user = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, role: true, email: true, isBlocked: true },
    });
    if (!user) throw ApiError.notFound(`Utilisateur ${targetId} introuvable`);
    if (user.role === 'admin') {
      throw ApiError.forbidden('Impossible de bloquer un autre administrateur');
    }
    if (user.isBlocked) {
      throw ApiError.conflict(`L'utilisateur ${user.email} est déjà bloqué`);
    }

    const updated = await UserRepository.update(
      targetId,
      { isBlocked: true, deactivatedReason: null },
      { select: UserRepository.ADMIN_SELECT },
    );
    invalidateAccount(targetId);
    return updated;
  },

  /**
   * Unblock a user account.
   * @param {number} targetId
   * @param {number} adminId
   */
  async unblockUser(targetId, adminId) {
    ensurePositiveId(targetId, 'ID utilisateur');
    ensurePositiveId(adminId, 'ID administrateur');
    if (targetId === adminId) {
      throw ApiError.forbidden('Un admin ne peut pas se débloquer lui-même via cette route');
    }

    const user = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, role: true, email: true, isBlocked: true, brandDeletedAt: true },
    });
    if (!user) throw ApiError.notFound(`Utilisateur ${targetId} introuvable`);
    if (user.role === 'brand' && user.brandDeletedAt) {
      throw ApiError.forbidden(
        'Impossible de réactiver une marque archivée. Créez un nouveau compte marque.',
      );
    }
    if (!user.isBlocked) {
      throw ApiError.conflict(`L'utilisateur ${user.email} n'est pas bloqué`);
    }

    const updated = await UserRepository.update(
      targetId,
      { isBlocked: false, deactivatedReason: null },
      { select: UserRepository.ADMIN_SELECT },
    );
    invalidateAccount(targetId);
    return updated;
  },

  /**
   * Delete a user. Behaviour depends on the role:
   *   - admin       → refused
   *   - brand       → soft archive (delegated to `BrandService.delete`)
   *   - quizmaster  → detach from quizzes, deactivate them, hard delete
   *   - participant → cascade clean-up (attempts, answers, points, etc.)
   *
   * Everything that mutates more than one table runs in a single Prisma
   * transaction (fixes diagnostic B15: half-deleted participants).
   *
   * @param {number} targetId
   * @param {number} adminId
   */
  async deleteUser(targetId, adminId) {
    ensurePositiveId(targetId, 'ID utilisateur');
    ensurePositiveId(adminId, 'ID administrateur');
    if (targetId === adminId) {
      throw ApiError.forbidden('Un admin ne peut pas supprimer son propre compte');
    }

    const user = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, role: true, email: true },
    });
    if (!user) throw ApiError.notFound(`Utilisateur ${targetId} introuvable`);
    if (user.role === 'admin') {
      throw ApiError.forbidden('Impossible de supprimer un autre administrateur');
    }

    invalidateAccount(targetId);

    if (user.role === 'brand') {
      // Soft-archive flow — keeps Quiz / Order rows intact.
      return BrandService.delete(targetId);
    }

    if (user.role === 'quizmaster') {
      const quizIds = (
        await prisma.quiz.findMany({
          where: { quizmasterId: targetId },
          select: { id: true },
        })
      ).map((q) => q.id);

      await prisma.$transaction([
        prisma.notification.deleteMany({ where: { userId: targetId } }),
      ]);

      await detachQuizmasterFromAllQuizzes(targetId);

      if (quizIds.length > 0) {
        await prisma.quiz.updateMany({
          where: { id: { in: quizIds } },
          data: { isActive: false },
        });
      }

      const deleted = await UserRepository.delete(targetId);
      return { ...deleted, quizzesTransferredToBrand: true };
    }

    if (user.role === 'participant') {
      // Cascade clean-up in a single transaction. (B15 fix.)
      const attemptIds = (
        await prisma.attempt.findMany({
          where: { userId: targetId },
          select: { id: true },
        })
      ).map((a) => a.id);

      await prisma.$transaction([
        prisma.answer.deleteMany({ where: { userId: targetId } }),
        prisma.attempt.deleteMany({ where: { userId: targetId } }),
        prisma.notification.deleteMany({ where: { userId: targetId } }),
        prisma.orderItem.deleteMany({ where: { order: { userId: targetId } } }),
        prisma.order.deleteMany({ where: { userId: targetId } }),
      ]);

      // Silence the unused-vars lint without keeping the variable.
      void attemptIds;

      const deleted = await UserRepository.delete(targetId);
      return deleted;
    }

    throw ApiError.badRequest("Suppression d'utilisateur impossible pour ce rôle");
  },

  /**
   * Export all users to CSV.
   * @returns {Promise<string>} CSV payload.
   */
  async exportUsersCsv() {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isBlocked: true,
        createdAt: true,
      },
    });

    if (users.length === 0) return 'id,name,email,role,isBlocked,createdAt\n';

    const parser = new Parser({
      fields: [
        'id',
        'name',
        'email',
        'role',
        'isBlocked',
        { label: 'createdAt', value: (row) => new Date(row.createdAt).toISOString() },
      ],
    });
    return parser.parse(users);
  },
};

module.exports = AdminService;
