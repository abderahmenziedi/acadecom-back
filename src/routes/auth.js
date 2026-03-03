const express = require("express");
const router = express.Router();
const AuthController = require("../controllers/authController");
const validate = require("../middlewares/validate");
const { registerSchema, loginSchema } = require("../validations/authValidation");

/**
 * Routes d'authentification publiques.
 * Tous les rôles peuvent s'inscrire et se connecter.
 *
 * POST /api/v1/auth/register - Inscription (USER, VISITEUR, BRAND)
 * POST /api/v1/auth/login    - Connexion (tous les rôles)
 */
router.post("/register", validate(registerSchema), AuthController.register);
router.post("/login", validate(loginSchema), AuthController.login);

module.exports = router;