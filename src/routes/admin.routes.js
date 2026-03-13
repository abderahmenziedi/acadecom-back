const express = require("express");
const router = express.Router();
const AdminController = require("../controllers/adminController");
const auth = require("../middlewares/auth");
const permit = require("../middlewares/role");

/**
 * Routes Admin — Gestion des utilisateurs.
 * Toutes les routes sont protégées par `auth` (JWT) + `permit("admin")` (RBAC).
 *
 * Ordre CRITIQUE des routes (Express match la première qui correspond):
 * 1. GET    /api/admin/users/export/csv   — Export CSV des users
 * 2. GET    /api/admin/users              — Liste tous les users (filtre + pagination)
 * 3. PATCH  /api/admin/users/:id/block    — Bloque un user
 * 4. PATCH  /api/admin/users/:id/unblock  — Débloque un user
 * 5. DELETE /api/admin/users/:id          — Supprime définitivement un user
 * 
 * ⚠️ Les routes spécifiques (sans :id) DOIVENT être AVANT les routes paramétrées (:id)!
 */

// Middleware appliqué à toutes les routes de ce router
router.use(auth, permit("admin"));

// ─── ROUTES SPÉCIFIQUES (pas d'ID) — EN PREMIER! ─────────────────────────────
// Important: /export/csv DOIT venir avant /users/:id pour éviter que "export" soit pris comme ID
router.get("/users/export/csv", AdminController.exportUsersCsv);
router.get("/users", AdminController.getAllUsers);

// ─── ROUTES PARAMÉTRÉES (:id) — EN DERNIER ────────────────────────────────────
router.patch("/users/:id/block", AdminController.blockUser);
router.patch("/users/:id/unblock", AdminController.unblockUser);
router.delete("/users/:id", AdminController.deleteUser);

module.exports = router;
