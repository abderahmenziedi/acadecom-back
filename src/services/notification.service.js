const prisma = require("../config/prisma");

/**
 * NotificationService — In-app notification management.
 */
const NotificationService = {
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

    return { notifications, total, unreadCount, page, totalPages: Math.ceil(total / limit) };
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

  async create(userId, { type, title, message }) {
    return prisma.notification.create({
      data: { userId, type, title, message },
    });
  },
};

module.exports = NotificationService;
