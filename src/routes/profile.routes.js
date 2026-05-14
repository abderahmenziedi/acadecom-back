const express = require("express");
const router = express.Router();
const ProfileController = require("../controllers/profile.controller");
const auth = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const {
    updateMeSchema,
    changePasswordSchema,
    changeAvatarSchema,
} = require("../validations/profile.validation");

/**
 * Profile routes — available to all authenticated users regardless of role.
 *
 * GET    /me             — Current user profile
 * PUT    /me             — Update profile fields (name, phone, bio, etc.)
 * PUT    /password       — Change password (with current password verification)
 * PUT    /avatar         — Set avatar URL (after upload)
 * DELETE /avatar         — Remove avatar
 */
router.use(auth);

router.get("/me", ProfileController.getMe);
router.put("/me", validate(updateMeSchema), ProfileController.updateMe);
router.put("/password", validate(changePasswordSchema), ProfileController.changePassword);
router.put("/avatar", validate(changeAvatarSchema), ProfileController.changeAvatar);
router.delete("/avatar", ProfileController.deleteAvatar);

module.exports = router;
