const express = require("express");
const router = express.Router();
const BrandController = require("../controllers/brand.controller");
const BrandAnalyticsController = require("../controllers/brandAnalytics.controller");
const auth = require("../middlewares/auth");
const permit = require("../middlewares/role");
const validate = require("../middlewares/validate");
const { updateBrandProfileSchema } = require("../validations/brand.validation");

/**
 * Routes Brand Self-Service.
 * Protégées par `auth` (JWT) + `permit("brand")` (RBAC).
 *
 * GET    /api/v1/brand/me            — Profil du brand connecté
 * PUT    /api/v1/brand/me            — Mettre à jour son profil (champs limités)
 * GET    /api/v1/brand/quizmasters   — Ses quizmasters
 * GET    /api/v1/brand/dashboard     — Dashboard analytics
 *
 * ⚠️ Les routes spécifiques DOIVENT être avant les routes paramétrées (:id)!
 */

router.use(auth, permit("brand", "admin"));

// ─── ROUTES SPÉCIFIQUES (brand self) ──────────────────────────────────────────
router.get("/me", permit("brand"), BrandController.getProfile);
router.put("/me", permit("brand"), validate(updateBrandProfileSchema), BrandController.updateProfile);
router.get("/quizmasters", permit("brand"), BrandController.getQuizmasters);
router.get("/dashboard", permit("brand"), BrandAnalyticsController.getDashboard);

// ─── ROUTES PARAMÉTRÉES (analytics par ID — admin ou brand propre) ────────────
router.get("/:id/analytics", BrandAnalyticsController.getBrandAnalytics);

module.exports = router;
