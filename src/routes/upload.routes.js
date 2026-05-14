const express = require("express");
const router = express.Router();
const UploadController = require("../controllers/upload.controller");
const auth = require("../middlewares/auth");
const { imageUploader } = require("../middlewares/upload");

/**
 * Image upload routes — authenticated users only.
 *
 * POST /api/v1/uploads/avatar    — Profile avatar
 * POST /api/v1/uploads/quiz      — Quiz cover image
 * POST /api/v1/uploads/product   — Product/coupon image
 * POST /api/v1/uploads/brand     — Brand logo
 * POST /api/v1/uploads/generic   — Fallback
 *
 * Each route expects a multipart/form-data body with a single `file` field.
 * Max size: 4 MB; allowed: jpg/png/webp/gif/svg.
 */
router.use(auth);

router.post("/avatar", imageUploader("avatars"), UploadController.uploadOne);
router.post("/quiz", imageUploader("quizzes"), UploadController.uploadOne);
router.post("/product", imageUploader("products"), UploadController.uploadOne);
router.post("/brand", imageUploader("brands"), UploadController.uploadOne);
router.post("/generic", imageUploader("misc"), UploadController.uploadOne);

module.exports = router;
