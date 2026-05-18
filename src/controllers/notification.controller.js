const NotificationService = require("../services/notification.service");
const asyncHandler = require("../utils/asyncHandler");

const list = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 30;
  const data = await NotificationService.listForUser(req.user.id, page, limit);
  res.json({ status: "success", data });
});

const unreadCount = asyncHandler(async (req, res) => {
  const count = await NotificationService.unreadCount(req.user.id);
  res.json({ status: "success", data: { count } });
});

const markOne = asyncHandler(async (req, res) => {
  await NotificationService.markRead(req.user.id, Number(req.params.id));
  res.json({ status: "success" });
});

const markAll = asyncHandler(async (req, res) => {
  await NotificationService.markAllRead(req.user.id);
  res.json({ status: "success" });
});

module.exports = { list, unreadCount, markOne, markAll };
