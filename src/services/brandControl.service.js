const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const NotificationService = require("./notification.service");
const ActivityLogService = require("./activityLog.service");

/**
 * BrandControlService — gives a Brand full control over its QuizMasters and Quizzes.
 *
 * All mutations also emit an activity log entry and a notification when relevant.
 * Ownership is enforced: a brand can only act on quizmasters whose `brandId` is theirs,
 * and on quizzes where `brandId` is theirs.
 */
const BrandControlService = {
    // ─── QuizMaster control ─────────────────────────────────────

    async _ensureQuizmasterOwnership(quizmasterId, brandId) {
        const qm = await prisma.user.findUnique({
            where: { id: quizmasterId },
            select: { id: true, role: true, brandId: true, name: true, email: true, isBlocked: true },
        });
        if (!qm || qm.role !== "quizmaster") {
            throw new ApiError(404, "Quizmaster introuvable");
        }
        if (qm.brandId !== brandId) {
            throw new ApiError(403, "Ce quizmaster ne fait pas partie de votre marque");
        }
        return qm;
    },

    async _ensureQuizOwnership(quizId, brandId) {
        const quiz = await prisma.quiz.findUnique({
            where: { id: quizId },
            select: { id: true, title: true, brandId: true, quizmasterId: true, isActive: true },
        });
        if (!quiz) throw new ApiError(404, "Quiz introuvable");
        if (quiz.brandId !== brandId) {
            throw new ApiError(403, "Ce quiz n'appartient pas à votre marque");
        }
        return quiz;
    },

    async blockQuizmaster(quizmasterId, brandId) {
        const qm = await this._ensureQuizmasterOwnership(quizmasterId, brandId);
        if (qm.isBlocked) throw new ApiError(409, "Ce quizmaster est déjà bloqué");

        const updated = await prisma.user.update({
            where: { id: quizmasterId },
            data: { isBlocked: true },
            select: { id: true, name: true, email: true, isBlocked: true },
        });

        // Désactiver également tous ses quizzes
        await prisma.quiz.updateMany({
            where: { quizmasterId, brandId },
            data: { isActive: false },
        });

        await NotificationService.notifyAccountBlocked({
            userId: quizmasterId,
            by: "votre marque",
        });
        await ActivityLogService.log({
            actorId: brandId,
            scopeId: brandId,
            action: "brand_block_quizmaster",
            entityType: "user",
            entityId: quizmasterId,
            metadata: { email: qm.email },
        });
        return updated;
    },

    async unblockQuizmaster(quizmasterId, brandId) {
        const qm = await this._ensureQuizmasterOwnership(quizmasterId, brandId);
        if (!qm.isBlocked) throw new ApiError(409, "Ce quizmaster n'est pas bloqué");

        const updated = await prisma.user.update({
            where: { id: quizmasterId },
            data: { isBlocked: false },
            select: { id: true, name: true, email: true, isBlocked: true },
        });
        await NotificationService.notifyAccountUnblocked({
            userId: quizmasterId,
            by: "votre marque",
        });
        await ActivityLogService.log({
            actorId: brandId,
            scopeId: brandId,
            action: "brand_unblock_quizmaster",
            entityType: "user",
            entityId: quizmasterId,
            metadata: { email: qm.email },
        });
        return updated;
    },

    async deleteQuizmaster(quizmasterId, brandId) {
        const qm = await this._ensureQuizmasterOwnership(quizmasterId, brandId);

        const quizIds = (await prisma.quiz.findMany({
            where: { quizmasterId, brandId },
            select: { id: true },
        })).map((q) => q.id);

        if (quizIds.length > 0) {
            await prisma.answer.deleteMany({ where: { attempt: { quizId: { in: quizIds } } } });
            const attemptIds = (await prisma.attempt.findMany({
                where: { quizId: { in: quizIds } },
                select: { id: true },
            })).map((a) => a.id);
            if (attemptIds.length > 0) {
                await prisma.pointsHistory.deleteMany({ where: { attemptId: { in: attemptIds } } });
            }
            await prisma.attempt.deleteMany({ where: { quizId: { in: quizIds } } });
            await prisma.option.deleteMany({ where: { question: { quizId: { in: quizIds } } } });
            await prisma.question.deleteMany({ where: { quizId: { in: quizIds } } });
            await prisma.quiz.deleteMany({ where: { id: { in: quizIds } } });
        }

        await prisma.userBadge.deleteMany({ where: { userId: quizmasterId } });
        await prisma.notification.deleteMany({ where: { userId: quizmasterId } });
        await prisma.user.delete({ where: { id: quizmasterId } });

        await ActivityLogService.log({
            actorId: brandId,
            scopeId: brandId,
            action: "brand_delete_quizmaster",
            entityType: "user",
            entityId: quizmasterId,
            metadata: { email: qm.email, name: qm.name },
        });

        return { id: quizmasterId, email: qm.email };
    },

    // ─── Quiz control ──────────────────────────────────────────

    async disableQuiz(quizId, brandId) {
        const quiz = await this._ensureQuizOwnership(quizId, brandId);
        if (!quiz.isActive) throw new ApiError(409, "Ce quiz est déjà inactif");

        const updated = await prisma.quiz.update({
            where: { id: quizId },
            data: { isActive: false },
            select: { id: true, title: true, isActive: true },
        });
        await ActivityLogService.log({
            actorId: brandId,
            scopeId: brandId,
            action: "brand_disable_quiz",
            entityType: "quiz",
            entityId: quizId,
            metadata: { title: quiz.title },
        });
        return updated;
    },

    async enableQuiz(quizId, brandId) {
        const quiz = await this._ensureQuizOwnership(quizId, brandId);
        if (quiz.isActive) throw new ApiError(409, "Ce quiz est déjà actif");

        const updated = await prisma.quiz.update({
            where: { id: quizId },
            data: { isActive: true },
            select: { id: true, title: true, isActive: true },
        });
        await ActivityLogService.log({
            actorId: brandId,
            scopeId: brandId,
            action: "brand_enable_quiz",
            entityType: "quiz",
            entityId: quizId,
            metadata: { title: quiz.title },
        });
        return updated;
    },

    async deleteQuiz(quizId, brandId) {
        const quiz = await this._ensureQuizOwnership(quizId, brandId);

        await prisma.answer.deleteMany({ where: { attempt: { quizId } } });
        const attemptIds = (await prisma.attempt.findMany({
            where: { quizId },
            select: { id: true },
        })).map((a) => a.id);
        if (attemptIds.length > 0) {
            await prisma.pointsHistory.deleteMany({ where: { attemptId: { in: attemptIds } } });
        }
        await prisma.attempt.deleteMany({ where: { quizId } });
        await prisma.option.deleteMany({ where: { question: { quizId } } });
        await prisma.question.deleteMany({ where: { quizId } });
        await prisma.quiz.delete({ where: { id: quizId } });

        await ActivityLogService.log({
            actorId: brandId,
            scopeId: brandId,
            action: "brand_delete_quiz",
            entityType: "quiz",
            entityId: quizId,
            metadata: { title: quiz.title },
        });
        return { id: quizId };
    },

    // ─── Read-only ─────────────────────────────────────────────

    async listQuizmasters(brandId, { page = 1, limit = 20, search } = {}) {
        const where = { brandId, role: "quizmaster" };
        if (search) {
            where.OR = [
                { name: { contains: search } },
                { email: { contains: search } },
            ];
        }
        const skip = (page - 1) * limit;

        const [quizmasters, total] = await prisma.$transaction([
            prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    avatar: true,
                    isBlocked: true,
                    createdAt: true,
                    bio: true,
                    phone: true,
                    _count: { select: { quizzes: true } },
                },
            }),
            prisma.user.count({ where }),
        ]);

        return { quizmasters, total, page, totalPages: Math.ceil(total / limit) };
    },

    async listQuizzes(brandId, { page = 1, limit = 20, search, isActive } = {}) {
        const where = { brandId };
        if (search) where.title = { contains: search };
        if (typeof isActive === "boolean") where.isActive = isActive;

        const skip = (page - 1) * limit;
        const [quizzes, total] = await prisma.$transaction([
            prisma.quiz.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    title: true,
                    description: true,
                    isActive: true,
                    imageUrl: true,
                    category: true,
                    difficulty: true,
                    createdAt: true,
                    updatedAt: true,
                    quizmaster: { select: { id: true, name: true, email: true, avatar: true } },
                    _count: { select: { questions: true, attempts: true } },
                },
            }),
            prisma.quiz.count({ where }),
        ]);
        return { quizzes, total, page, totalPages: Math.ceil(total / limit) };
    },

    async listParticipants(brandId, { page = 1, limit = 20 } = {}) {
        // Participants who attempted at least one quiz of this brand
        const userIdsRows = await prisma.attempt.findMany({
            where: { quiz: { brandId }, completedAt: { not: null } },
            distinct: ["userId"],
            select: { userId: true },
        });
        const userIds = userIdsRows.map((r) => r.userId);
        if (userIds.length === 0) {
            return { participants: [], total: 0, page, totalPages: 0 };
        }

        const skip = (page - 1) * limit;
        const total = userIds.length;
        const slice = userIds.slice(skip, skip + limit);

        const participants = await prisma.user.findMany({
            where: { id: { in: slice } },
            select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
                xp: true,
                level: true,
                totalPoints: true,
                createdAt: true,
            },
        });

        // attach attempt count + last attempt for each on this brand
        const attemptStats = await prisma.attempt.groupBy({
            by: ["userId"],
            where: { quiz: { brandId }, userId: { in: slice }, completedAt: { not: null } },
            _count: true,
            _max: { completedAt: true, score: true },
        });
        const statMap = new Map(attemptStats.map((s) => [s.userId, s]));

        return {
            participants: participants.map((p) => ({
                ...p,
                attempts: statMap.get(p.id)?._count || 0,
                bestScore: statMap.get(p.id)?._max?.score || 0,
                lastAttemptAt: statMap.get(p.id)?._max?.completedAt || null,
            })),
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    },

    async getStats(brandId) {
        const [quizzes, quizmasters, totalAttempts, activeQuizzes, totalCouponsUsed] = await prisma.$transaction([
            prisma.quiz.count({ where: { brandId } }),
            prisma.user.count({ where: { brandId, role: "quizmaster" } }),
            prisma.attempt.count({ where: { quiz: { brandId }, completedAt: { not: null } } }),
            prisma.quiz.count({ where: { brandId, isActive: true } }),
            prisma.order.aggregate({
                where: { items: { some: { product: { brandId } } } },
                _sum: { totalPrice: true },
            }),
        ]);
        const uniqueParticipants = await prisma.attempt.findMany({
            where: { quiz: { brandId }, completedAt: { not: null } },
            distinct: ["userId"],
            select: { userId: true },
        });

        return {
            quizzes,
            activeQuizzes,
            quizmasters,
            totalAttempts,
            uniqueParticipants: uniqueParticipants.length,
            totalCouponsUsed: totalCouponsUsed._sum?.totalPrice || 0,
        };
    },
};

module.exports = BrandControlService;
