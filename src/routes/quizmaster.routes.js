const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.middleware");
const enforceActiveAccount = require("../middlewares/enforceActiveAccount.middleware");
const permit = require("../middlewares/role.middleware");
const uploadQuizmasterPhotoOptional = require("../middlewares/uploadQuizmasterPhoto.middleware");
const requireQuizmasterProfileComplete = require("../middlewares/quizmasterProfileComplete.middleware");
const requireQuizmasterApproved = require("../middlewares/quizmasterApproved.middleware");
const QuizmasterController = require("../controllers/quizmaster.controller");
const QuizmasterProfileController = require("../controllers/quizmasterProfile.controller");
const enforceBrandBillingFreshness = require("../middlewares/brandBillingFreshness.middleware");

router.use(auth, enforceActiveAccount, permit("quizmaster"));
router.get("/approval-status", QuizmasterProfileController.getApprovalStatus);

router.use(requireQuizmasterApproved);
router.use(enforceBrandBillingFreshness);

router.get("/profile", QuizmasterProfileController.getProfile);
router.patch("/profile", uploadQuizmasterPhotoOptional, QuizmasterProfileController.patchProfile);

router.use(requireQuizmasterProfileComplete);

router.get("/quizzes", QuizmasterController.list);
router.post("/quizzes", QuizmasterController.create);
router.get("/quizzes/:id", QuizmasterController.getOne);
router.put("/quizzes/:id", QuizmasterController.update);
router.delete("/quizzes/:id", QuizmasterController.remove);
router.post("/quizzes/:quizId/questions", QuizmasterController.addQuestion);
router.put("/questions/:questionId", QuizmasterController.updateQuestion);
router.delete("/questions/:questionId", QuizmasterController.deleteQuestion);

module.exports = router;
