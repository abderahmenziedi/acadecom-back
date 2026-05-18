const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.middleware");
const enforceActiveAccount = require("../middlewares/enforceActiveAccount.middleware");
const permit = require("../middlewares/role.middleware");
const ProfileController = require("../controllers/profile.controller");

router.use(auth, enforceActiveAccount, permit("participant", "quizmaster"));

router.put("/change-password", ProfileController.changePassword);

module.exports = router;
