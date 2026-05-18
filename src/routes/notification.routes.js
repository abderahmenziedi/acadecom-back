const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.middleware");
const enforceActiveAccount = require("../middlewares/enforceActiveAccount.middleware");
const NotificationController = require("../controllers/notification.controller");

router.use(auth, enforceActiveAccount);

router.get("/", NotificationController.list);
router.get("/unread-count", NotificationController.unreadCount);
router.patch("/read-all", NotificationController.markAll);
router.patch("/:id/read", NotificationController.markOne);

module.exports = router;
