const express = require("express");
const router = express.Router();
const QuizmasterController = require("../controllers/quizmaster.controller");
const auth = require("../middlewares/auth");
const permit = require("../middlewares/role");
const validate = require("../middlewares/validate");
const { createQuizmasterSchema, updateQuizmasterSchema } = require("../validations/quizmaster.validation");

/**
 * Routes Admin — Gestion des quizmasters.
 * Toutes les routes sont protégées par `auth` (JWT) + `permit("admin")` (RBAC).
 *
 * POST   /api/v1/admin/quizmasters       — Créer un quizmaster
 * GET    /api/v1/admin/quizmasters       — Lister tous les quizmasters (paginé, filtre brandId)
 * GET    /api/v1/admin/quizmasters/:id   — Récupérer un quizmaster par ID
 * PUT    /api/v1/admin/quizmasters/:id   — Mettre à jour un quizmaster
 * DELETE /api/v1/admin/quizmasters/:id   — Supprimer un quizmaster
 */

// Middleware appliqué à toutes les routes de ce router
router.use(auth, permit("admin"));

// ─── ROUTES COLLECTION ────────────────────────────────────────────────────────
router.post("/", validate(createQuizmasterSchema), QuizmasterController.create);
router.get("/", QuizmasterController.getAll);

// ─── ROUTES PARAMÉTRÉES (:id) ─────────────────────────────────────────────────
router.get("/:id", QuizmasterController.getById);
router.put("/:id", validate(updateQuizmasterSchema), QuizmasterController.update);
router.delete("/:id", QuizmasterController.delete);

module.exports = router;
