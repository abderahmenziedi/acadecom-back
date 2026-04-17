const express = require("express");
const router = express.Router();
const NotificationController = require("../controllers/notification.controller");
const auth = require("../middlewares/auth");

/**
 * Notification Routes — accessible to all authenticated users
 *
 * GET    /                  — List notifications
 * GET    /unread-count      — Unread count
 * PATCH  /:id/read          — Mark one as read
 * PATCH  /read-all          — Mark all as read
 */

router.use(auth);

router.get("/", NotificationController.getNotifications);
router.get("/unread-count", NotificationController.getUnreadCount);
router.patch("/read-all", NotificationController.markAllAsRead);
router.patch("/:id/read", NotificationController.markAsRead);

module.exports = router;
