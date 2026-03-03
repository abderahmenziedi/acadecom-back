const prisma = require("../config/prisma");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const ApiError = require("../utils/ApiError");

/**
 * AuthService - Couche Service (logique métier).
 * Ne connaît pas res/req. Ne fait que travailler avec les données.
 */
const AuthService = {
    /**
     * Inscription d'un nouvel utilisateur.
     * Tous les rôles (USER, VISITEUR, BRAND) sont acceptés — ADMIN est refusé.
     * @param {{ email: string, password: string, role?: string }} data
     * @returns {{ id, email, role, createdAt }}
     */
    async register(data) {
        const { email, password, role } = data;

        // Vérifier si l'email est déjà utilisé
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            throw new ApiError(409, "Cet email est déjà enregistré");
        }

        const hashed = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: { email, password: hashed, role },
            select: { id: true, email: true, role: true, createdAt: true },
        });

        return user;
    },

    /**
     * Connexion d'un utilisateur (tous les rôles autorisés).
     * @param {{ email: string, password: string }} credentials
     * @returns {{ token: string, user: { id, email, role } }}
     */
    async login({ email, password }) {
        const user = await prisma.user.findUnique({ where: { email } });

        // On ne distingue pas "email introuvable" de "mauvais mot de passe" (sécurité)
        if (!user) {
            throw new ApiError(401, "Identifiants invalides");
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            throw new ApiError(401, "Identifiants invalides");
        }

        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        return {
            token,
            user: { id: user.id, email: user.email, role: user.role },
        };
    },
};

module.exports = AuthService;
