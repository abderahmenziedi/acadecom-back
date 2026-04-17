const NotificationService = require("../services/notification.service");
const ApiError = require("../utils/ApiError");

const NotificationController = {
  async getNotifications(req, res, next) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 20;
      const unreadOnly = req.query.unreadOnly === "true";
      const data = await NotificationService.getNotifications(req.user.id, { page, limit, unreadOnly });
      res.json({ status: "success", data });
    } catch (err) { next(err); }
  },

  async getUnreadCount(req, res, next) {
    try {
      const count = await NotificationService.getUnreadCount(req.user.id);
      res.json({ status: "success", data: { count } });
    } catch (err) { next(err); }
  },

  async markAsRead(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      if (!id) throw new ApiError(400, "ID notification invalide");
      await NotificationService.markAsRead(id, req.user.id);
      res.json({ status: "success", message: "Notification marquée comme lue" });
    } catch (err) { next(err); }
  },

  async markAllAsRead(req, res, next) {
    try {
      await NotificationService.markAllAsRead(req.user.id);
      res.json({ status: "success", message: "Toutes les notifications marquées comme lues" });
    } catch (err) { next(err); }
  },
};

module.exports = NotificationController;
