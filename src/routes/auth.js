const express = require("express");
const router = express.Router();
const AuthController = require("../controllers/authController");
const validate = require("../middlewares/validate");
const auth = require("../middlewares/auth");
const { registerSchema, loginSchema } = require("../validations/authValidation");

/**
 * Routes d'authentification.
 *
 * POST /api/v1/auth/register - Inscription (participant, brand, quizmaster, admin)
 * POST /api/v1/auth/login    - Connexion (tous les rôles)
 * POST /api/v1/auth/logout   - Déconnexion (utilisateurs authentifiés uniquement)
 */
router.post("/register", validate(registerSchema), AuthController.register);
router.post("/login", validate(loginSchema), AuthController.login);
router.post("/logout", auth, AuthController.logout);

module.exports = router;