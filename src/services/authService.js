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
     * Tous les rôles sont acceptés (participant, brand, quizmaster, admin).
     * Si quizmaster, brandId est obligatoire et doit pointer vers un utilisateur avec rôle "brand".
     * @param {{ email: string, password: string, role?: string, brandId?: number }} data
     * @returns {{ id, email, role, brandId, brand, createdAt }}
     */
    async register(data) {
        const { email, password, role = "participant", brandId } = data;

        // Vérifier si l'email est déjà utilisé
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            throw new ApiError(409, "Cet email est déjà enregistré");
        }

        // SEULEMENT les quizmasters peuvent avoir un brandId
        if (role !== "quizmaster" && brandId) {
            throw new ApiError(400, `Les ${role}s ne peuvent pas avoir une marque (brandId). Seuls les quizmasters peuvent sélectionner une marque.`);
        }

        // Si quizmaster, vérifier que brandId est fourni et que l'utilisateur brand existe
        if (role === "quizmaster") {
            if (!brandId) {
                throw new ApiError(400, "Un quizmaster doit obligatoirement sélectionner une marque (brand)");
            }
            const brandUser = await prisma.user.findUnique({ where: { id: brandId } });
            if (!brandUser) {
                throw new ApiError(404, "Marque (utilisateur) non trouvée");
            }
            if (brandUser.role !== "brand") {
                throw new ApiError(400, "L'utilisateur sélectionné doit avoir le rôle 'brand'");
            }
        }

        const hashed = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                email,
                password: hashed,
                role,
                ...(role === "quizmaster" && brandId && { brandId }),
            },
            include: role === "quizmaster" ? {
                brand: { select: { id: true, email: true, role: true } },
            } : undefined,
        });

        return user;
    },

    /**
     * Connexion d'un utilisateur (tous les rôles autorisés).
     * @param {{ email: string, password: string }} credentials
     * @returns {{ token: string, user: { id, email, role, brandId, brand } }}
     */
    async login({ email, password }) {
        const user = await prisma.user.findUnique({
            where: { email },
        });

        // On ne distingue pas "email introuvable" de "mauvais mot de passe" (sécurité)
        if (!user) {
            throw new ApiError(401, "Identifiants invalides");
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            throw new ApiError(401, "Identifiants invalides");
        }

        // Vérifier si le compte est bloqué par un administrateur
        if (user.isBlocked) {
            throw new ApiError(403, "Votre compte a été suspendu. Veuillez contacter un administrateur.");
        }

        // Pour les quizmasters, inclure les détails de la brand
        let brand = undefined;
        if (user.role === "quizmaster" && user.brandId) {
            brand = await prisma.user.findUnique({
                where: { id: user.brandId },
                select: { id: true, email: true, role: true },
            });
        }

        // Token JWT incluant id, role et optionnellement brandId pour les quizmasters
        const token = jwt.sign(
            {
                id: user.id,
                role: user.role,
                ...(user.role === "quizmaster" && user.brandId && { brandId: user.brandId }),
            },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                ...(user.role === "quizmaster" && { brandId: user.brandId, brand }),
            },
        };
    },

    /**
     * Logout d'un utilisateur.
     * Avec JWT stateless, c'est essentiellement une opération client.
     * Le serveur confirme juste qu'on peut oublier le token côté client.
     * @param {number} userId - ID de l'utilisateur (optionnel, pour logs/audit)
     * @returns {{ message: string }}
     */
    async logout(userId) {
        // Ici on pourrait logger la déconnexion si nécessaire
        return { message: "Déconnexion réussie" };
    },
};

module.exports = AuthService;
