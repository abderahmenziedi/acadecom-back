const AuthService = require("../services/authService");

/**
 * AuthController - Couche Controller.
 * Récupère les données HTTP, appelle le service, formate la réponse.
 * express-async-handler n'est pas nécessaire ici car app.js utilise une gestion d'erreur async.
 */
const AuthController = {
    /**
     * POST /api/v1/auth/register
     * Accessible à tous. Crée un utilisateur avec rôle (participant, brand, quizmaster, admin).
     */
    async register(req, res, next) {
        try {
            const user = await AuthService.register(req.body);
            res.status(201).json({
                status: "success",
                message: "Compte créé avec succès",
                data: { user },
            });
        } catch (err) {
            next(err); // Transmet l'erreur au middleware global
        }
    },

    /**
     * POST /api/v1/auth/login
     * Accessible à tous les rôles (participant, brand, quizmaster, admin).
     */
    async login(req, res, next) {
        try {
            const { token, user } = await AuthService.login(req.body);
            res.status(200).json({
                status: "success",
                data: { token, user },
            });
        } catch (err) {
            next(err);
        }
    },

    /**
     * POST /api/v1/auth/logout
     * Accessible aux utilisateurs authentifiés.
     * JWT étant stateless, c'est juste une confirmation client-side.
     */
    async logout(req, res, next) {
        try {
            const result = await AuthService.logout(req.user.id);
            res.status(200).json({
                status: "success",
                message: result.message,
            });
        } catch (err) {
            next(err);
        }
    },
};

module.exports = AuthController;
