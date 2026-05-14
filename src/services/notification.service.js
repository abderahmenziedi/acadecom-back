const prisma = require("../config/prisma");
const logger = require("../utils/logger");

/**
 * NotificationService — in-app notifications.
 *
 * Conventions:
 *  - `type`  : one of NotificationType enum values
 *  - `title` : short, ~50 chars
 *  - `message`: human-readable body
 *  - `link`  : optional frontend route hint (e.g. /participant/quizzes)
 */
const NotificationService = {
    // ─── Queries ────────────────────────────────────────────────

    async getNotifications(userId, { page = 1, limit = 20, unreadOnly = false }) {
        const where = { userId };
        if (unreadOnly) where.isRead = false;

        const skip = (page - 1) * limit;

        const [notifications, total, unreadCount] = await prisma.$transaction([
            prisma.notification.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
            }),
            prisma.notification.count({ where }),
            prisma.notification.count({ where: { userId, isRead: false } }),
        ]);

        return {
            notifications,
            total,
            unreadCount,
            page,
            totalPages: Math.ceil(total / limit),
        };
    },

    async getUnreadCount(userId) {
        return prisma.notification.count({ where: { userId, isRead: false } });
    },

    async markAsRead(notificationId, userId) {
        const notif = await prisma.notification.findUnique({ where: { id: notificationId } });
        if (!notif || notif.userId !== userId) return null;
        return prisma.notification.update({
            where: { id: notificationId },
            data: { isRead: true },
        });
    },

    async markAllAsRead(userId) {
        return prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true },
        });
    },

    async deleteOne(notificationId, userId) {
        const notif = await prisma.notification.findUnique({ where: { id: notificationId } });
        if (!notif || notif.userId !== userId) return null;
        return prisma.notification.delete({ where: { id: notificationId } });
    },

    async deleteAllRead(userId) {
        return prisma.notification.deleteMany({ where: { userId, isRead: true } });
    },

    // ─── Emit helpers (never throw — notifications must not break business logic) ──

    async _safeCreate(data) {
        try {
            return await prisma.notification.create({ data });
        } catch (e) {
            logger.warn(`Notification create failed: ${e.message}`);
            return null;
        }
    },

    async create(userId, { type, title, message, link }) {
        if (!userId) return null;
        return this._safeCreate({ userId, type, title, message, link: link || null });
    },

    async createMany(userIds, { type, title, message, link }) {
        const unique = [...new Set((userIds || []).filter(Boolean))];
        if (unique.length === 0) return null;
        try {
            return await prisma.notification.createMany({
                data: unique.map((userId) => ({
                    userId,
                    type,
                    title,
                    message,
                    link: link || null,
                })),
            });
        } catch (e) {
            logger.warn(`Notifications bulk create failed: ${e.message}`);
            return null;
        }
    },

    // ─── Domain emitters ────────────────────────────────────────

    /** Quizmaster created a quiz → notify brand. */
    async notifyQuizCreated({ brandId, quizmasterName, quizTitle, quizId }) {
        return this.create(brandId, {
            type: "quiz_created",
            title: "Nouveau quiz créé",
            message: `${quizmasterName || "Un quizmaster"} a ajouté le quiz « ${quizTitle} ».`,
            link: `/brand/quizzes`,
        });
    },

    /** Quizmaster deleted a quiz → notify brand. */
    async notifyQuizDeleted({ brandId, quizmasterName, quizTitle }) {
        return this.create(brandId, {
            type: "quiz_deleted",
            title: "Quiz supprimé",
            message: `${quizmasterName || "Un quizmaster"} a supprimé le quiz « ${quizTitle} ».`,
            link: `/brand/quizzes`,
        });
    },

    /** Participant completed a quiz → notify quizmaster + brand. */
    async notifyQuizPlayed({ quizmasterId, brandId, participantName, quizTitle, score, maxScore, quizId }) {
        const summary = `${participantName || "Un participant"} a joué « ${quizTitle} » (score: ${score}/${maxScore}).`;
        await this.create(quizmasterId, {
            type: "quiz_played",
            title: "Quiz joué",
            message: summary,
            link: `/quizmaster/quizzes/${quizId}/analytics`,
        });
        await this.create(brandId, {
            type: "quiz_played",
            title: "Activité sur un quiz",
            message: summary,
            link: `/brand/analytics`,
        });
    },

    /** Confirmation for the participant. */
    async notifyParticipantQuizPlayed({ userId, quizTitle, score, maxScore, xpEarned, couponsEarned }) {
        return this.create(userId, {
            type: "quiz_completed",
            title: "Quiz terminé",
            message: `« ${quizTitle} » — Score: ${score}/${maxScore}. +${xpEarned || 0} XP${couponsEarned ? ` · +${couponsEarned} coupons` : ""}.`,
            link: `/participant/attempts`,
        });
    },

    /** Coupon redeemed → notify brand. */
    async notifyCouponUsed({ brandIds, participantName, totalPrice, items }) {
        const ids = Array.isArray(brandIds) ? brandIds : [brandIds];
        const titles = items.map((i) => i.title).join(", ");
        await this.createMany(ids, {
            type: "coupon_used",
            title: "Coupons utilisés",
            message: `${participantName || "Un participant"} a échangé ${totalPrice} coupons (${titles || "produit"}).`,
            link: `/brand/products`,
        });
    },

    /** Order confirmed → notify participant. */
    async notifyOrderConfirmed({ userId, orderId, totalPrice }) {
        return this.create(userId, {
            type: "order_confirmed",
            title: "Commande confirmée",
            message: `Votre commande #${orderId} (${totalPrice} coupons) a été confirmée.`,
            link: `/participant/orders`,
        });
    },

    /** Account blocked/unblocked by admin or brand. */
    async notifyAccountBlocked({ userId, by }) {
        return this.create(userId, {
            type: "account_blocked",
            title: "Compte suspendu",
            message: `Votre compte a été suspendu par ${by || "l'administration"}. Contactez le support.`,
        });
    },
    async notifyAccountUnblocked({ userId, by }) {
        return this.create(userId, {
            type: "account_unblocked",
            title: "Compte réactivé",
            message: `Votre compte a été réactivé par ${by || "l'administration"}.`,
        });
    },

    /** Threshold-based stats notifications for quizmaster. */
    async notifyQuizStatsMilestone({ quizmasterId, quizTitle, milestone, quizId }) {
        return this.create(quizmasterId, {
            type: "system",
            title: "Cap franchi",
            message: `Votre quiz « ${quizTitle} » a atteint ${milestone} participations !`,
            link: `/quizmaster/quizzes/${quizId}/analytics`,
        });
    },
};

module.exports = NotificationService;
