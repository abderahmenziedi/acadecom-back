const prisma = require("../prisma/client");

async function listForUser(userId, page = 1, limit = 30) {
  const skip = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { id: "desc" },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where: { userId } }),
  ]);
  return { notifications: rows, total, page, pages: Math.ceil(total / limit) };
}

async function markRead(userId, id) {
  await prisma.notification.updateMany({
    where: { userId, id: Number(id) },
    data: { isRead: true },
  });
}

async function markAllRead(userId) {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}

async function unreadCount(userId) {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

module.exports = { listForUser, markRead, markAllRead, unreadCount };
