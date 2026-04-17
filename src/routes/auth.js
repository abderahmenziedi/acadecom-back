const express = require("express");
const router = express.Router();
const AuthController = require("../controllers/authController");
const validate = require("../middlewares/validate");
const auth = require("../middlewares/auth");
const prisma = require("../config/prisma");
const { registerSchema, loginSchema } = require("../validations/authValidation");

/**
 * Routes d'authentification.
 *
 * POST /api/v1/auth/register     - Inscription (participant, brand, quizmaster)
 * POST /api/v1/auth/login        - Connexion (tous les rôles)
 * POST /api/v1/auth/logout       - Déconnexion (utilisateurs authentifiés uniquement)
 * GET  /api/v1/auth/brands       - Liste publique des brands (pour inscription quizmaster)
 */
router.post("/register", validate(registerSchema), AuthController.register);
router.post("/login", validate(loginSchema), AuthController.login);
router.post("/logout", auth, AuthController.logout);

// Route publique pour lister les brands (utilisée lors de l'inscription quizmaster)
router.get("/brands", async (req, res, next) => {
    try {
        const brands = await prisma.user.findMany({
            where: { role: "brand", isBlocked: false },
            select: { id: true, name: true, industry: true },
            orderBy: { name: "asc" },
        });
        res.status(200).json({ status: "success", data: { brands } });
    } catch (err) {
        next(err);
    }
});

module.exports = router;