const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.middleware");
const permit = require("../middlewares/role.middleware");
const enforceActiveAccount = require("../middlewares/enforceActiveAccount.middleware");
const BrandController = require("../controllers/brand.controller");
const uploadProductImageOptional = require("../middlewares/uploadProductImage.middleware");
const enforceBrandBillingFreshness = require("../middlewares/brandBillingFreshness.middleware");

router.use(auth, enforceActiveAccount, permit("brand"));
router.use(enforceBrandBillingFreshness);

router.get("/dashboard", BrandController.dashboard);
router.get("/subscription", BrandController.subscription);
router.get("/billing", BrandController.billing);
router.get("/quizmasters", BrandController.quizmasters);
router.post("/quizmasters/:id/approve", BrandController.approveQm);
router.post("/quizmasters/:id/reject", BrandController.rejectQm);
router.post("/quizmasters/:id/block", BrandController.blockQm);
router.post("/quizmasters/:id/unblock", BrandController.unblockQm);
router.delete("/quizmasters/:id", BrandController.deleteQm);
router.get("/quizzes", BrandController.quizzes);
router.post("/quizzes/:id/activate", BrandController.activateQuiz);
router.post("/quizzes/:id/deactivate", BrandController.deactivateQuiz);
router.delete("/quizzes/:id", BrandController.deleteQuiz);
router.get("/products", BrandController.products);
router.post("/products", uploadProductImageOptional, BrandController.createProduct);
router.put("/products/:id", uploadProductImageOptional, BrandController.updateProduct);
router.delete("/products/:id", BrandController.deleteProduct);

module.exports = router;
