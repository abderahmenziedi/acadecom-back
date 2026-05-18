const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.middleware");
const permit = require("../middlewares/role.middleware");
const enforceActiveAccount = require("../middlewares/enforceActiveAccount.middleware");
const AdminController = require("../controllers/admin.controller");

router.use(auth, enforceActiveAccount, permit("admin"));

router.get("/users/export/csv", AdminController.exportCsv);
router.get("/users", AdminController.listUsers);
router.patch("/users/:id/block", AdminController.blockUser);
router.patch("/users/:id/unblock", AdminController.unblockUser);
router.delete("/users/:id", AdminController.deleteUser);

module.exports = router;
