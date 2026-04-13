const express = require("express");
const router = express.Router();
const BrandController = require("../controllers/brand.controller");
const auth = require("../middlewares/auth");
const permit = require("../middlewares/role");
const validate = require("../middlewares/validate");
const { createBrandSchema, updateBrandSchema } = require("../validations/brand.validation");

/**
 * Routes Admin — Gestion des brands.
 * Toutes les routes sont protégées par `auth` (JWT) + `permit("admin")` (RBAC).
 *
 * POST   /api/v1/admin/brands       — Créer un brand
 * GET    /api/v1/admin/brands       — Lister tous les brands (paginé)
 * GET    /api/v1/admin/brands/:id   — Récupérer un brand par ID
 * PUT    /api/v1/admin/brands/:id   — Mettre à jour un brand
 * DELETE /api/v1/admin/brands/:id   — Supprimer un brand
 */

// Middleware appliqué à toutes les routes de ce router
router.use(auth, permit("admin"));

// ─── ROUTES COLLECTION ────────────────────────────────────────────────────────
router.post("/", validate(createBrandSchema), BrandController.create);
router.get("/", BrandController.getAll);

// ─── ROUTES PARAMÉTRÉES (:id) ─────────────────────────────────────────────────
router.get("/:id", BrandController.getById);
router.put("/:id", validate(updateBrandSchema), BrandController.update);
router.delete("/:id", BrandController.delete);

module.exports = router;
