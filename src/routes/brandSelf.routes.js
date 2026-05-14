const express = require("express");
const router = express.Router();
const BrandController = require("../controllers/brand.controller");
const BrandAnalyticsController = require("../controllers/brandAnalytics.controller");
const BrandControlController = require("../controllers/brandControl.controller");
const auth = require("../middlewares/auth");
const permit = require("../middlewares/role");
const validate = require("../middlewares/validate");
const { updateBrandProfileSchema } = require("../validations/brand.validation");

/**
 * Routes Brand Self-Service & Control.
 * Protégées par `auth` (JWT) + `permit("brand")` (RBAC).
 *
 * Self-service:
 *  GET    /api/v1/brand/me            — Profil du brand connecté
 *  PUT    /api/v1/brand/me            — Mettre à jour son profil (champs limités)
 *  GET    /api/v1/brand/dashboard     — Dashboard analytics
 *
 * Control:
 *  GET    /api/v1/brand/quizmasters            — Lister ses quizmasters
 *  POST   /api/v1/brand/quizmasters/:id/block  — Bloquer un quizmaster
 *  POST   /api/v1/brand/quizmasters/:id/unblock— Débloquer un quizmaster
 *  DELETE /api/v1/brand/quizmasters/:id        — Supprimer un quizmaster
 *  GET    /api/v1/brand/quizzes                — Lister tous ses quizzes
 *  POST   /api/v1/brand/quizzes/:id/enable     — Activer un quiz
 *  POST   /api/v1/brand/quizzes/:id/disable    — Désactiver un quiz
 *  DELETE /api/v1/brand/quizzes/:id            — Supprimer un quiz
 *  GET    /api/v1/brand/participants           — Lister les participants
 *  GET    /api/v1/brand/stats                  — Statistiques globales
 *  GET    /api/v1/brand/activity               — Historique d'audit
 *
 * ⚠️ Routes spécifiques avant routes paramétrées (:id).
 */

router.use(auth, permit("brand", "admin"));

// ─── Self ─────────────────────────────────────────────────────────────────────
router.get("/me", permit("brand"), BrandController.getProfile);
router.put("/me", permit("brand"), validate(updateBrandProfileSchema), BrandController.updateProfile);
router.get("/dashboard", permit("brand"), BrandAnalyticsController.getDashboard);
router.get("/stats", permit("brand"), BrandControlController.getStats);

// ─── QuizMaster control ─────────────────────────────────────────────────────
router.get("/quizmasters", permit("brand"), BrandControlController.listQuizmasters);
router.post("/quizmasters/:id/block", permit("brand"), BrandControlController.blockQuizmaster);
router.post("/quizmasters/:id/unblock", permit("brand"), BrandControlController.unblockQuizmaster);
router.delete("/quizmasters/:id", permit("brand"), BrandControlController.deleteQuizmaster);

// ─── Quiz control ───────────────────────────────────────────────────────────
router.get("/quizzes", permit("brand"), BrandControlController.listQuizzes);
router.post("/quizzes/:id/enable", permit("brand"), BrandControlController.enableQuiz);
router.post("/quizzes/:id/disable", permit("brand"), BrandControlController.disableQuiz);
router.delete("/quizzes/:id", permit("brand"), BrandControlController.deleteQuiz);

// ─── Participants & activity ────────────────────────────────────────────────
router.get("/participants", permit("brand"), BrandControlController.listParticipants);
router.get("/activity", permit("brand"), BrandControlController.getActivity);

// ─── ROUTES PARAMÉTRÉES (analytics par ID — admin ou brand propre) ──────────
router.get("/:id/analytics", BrandAnalyticsController.getBrandAnalytics);

module.exports = router;
