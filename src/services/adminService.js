const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const { Parser } = require("json2csv");

const adminUserSelect = {
    id: true,
    name: true,
    email: true,
    role: true,
    isBlocked: true,
    createdAt: true,
};

function validatePositiveId(value, label) {
    if (!Number.isInteger(value) || value <= 0) {
        throw new ApiError(400, `${label} invalide`);
    }
}

/**
 * AdminService — Logique métier pour la gestion des utilisateurs par l'admin.
 * Ne connaît pas req/res. Travaille uniquement avec les données.
 */
const AdminService = {
    /**
     * Récupère la liste paginée de tous les utilisateurs avec filtrage optionnel par rôle.
     * @param {{ role?: string, page: number, limit: number }} options
     * @returns {{ users: Array, total: number, page: number, totalPages: number }}
     */
    async getAllUsers({ role, page = 1, limit = 10 }) {
        const where = role ? { role } : {};
        const skip = (page - 1) * limit;

        const [users, total] = await prisma.$transaction([
            prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    isBlocked: true,
                    brandId: true,
                    createdAt: true,
                },
            }),
            prisma.user.count({ where }),
        ]);

        return {
            users,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    },

    /**
     * Bloque un utilisateur (isBlocked = true).
     * L'admin ne peut pas se bloquer lui-même.
     * Impossible de bloquer un autre admin.
     * @param {number} targetId - ID de l'utilisateur à bloquer
     * @param {number} adminId  - ID de l'admin qui fait la demande
     * @returns {Object} Utilisateur mis à jour
     */
    async blockUser(targetId, adminId) {
        validatePositiveId(targetId, "ID utilisateur");
        validatePositiveId(adminId, "ID administrateur");

        // Vérifier que l'admin ne se bloque pas lui-même
        if (targetId === adminId) {
            throw new ApiError(403, "Un admin ne peut pas bloquer son propre compte");
        }

        // Récupérer l'utilisateur à bloquer
        const user = await prisma.user.findUnique({ 
            where: { id: targetId },
            select: { id: true, role: true, isBlocked: true, email: true },
        });

        if (!user) {
            throw new ApiError(404, `Utilisateur avec ID ${targetId} introuvable`);
        }

        // Empêcher de bloquer un autre admin
        if (user.role === "admin") {
            throw new ApiError(403, "Impossible de bloquer un autre administrateur");
        }

        // Empêcher de re-bloquer un utilisateur déjà bloqué
        if (user.isBlocked) {
            throw new ApiError(409, `L'utilisateur ${user.email} est déjà bloqué`);
        }

        // Bloquer l'utilisateur
        return prisma.user.update({
            where: { id: targetId },
            data: { isBlocked: true },
            select: adminUserSelect,
        });
    },

    /**
     * Débloque un utilisateur (isBlocked = false).
     * L'admin ne peut pas se débloquer lui-même via cette route.
     * @param {number} targetId - ID de l'utilisateur à débloquer
     * @param {number} adminId  - ID de l'admin qui fait la demande
     * @returns {Object} Utilisateur mis à jour
     */
    async unblockUser(targetId, adminId) {
        validatePositiveId(targetId, "ID utilisateur");
        validatePositiveId(adminId, "ID administrateur");

        // Vérifier que l'admin ne se débloque pas lui-même (procédure suspecte)
        if (targetId === adminId) {
            throw new ApiError(403, "Un admin ne peut pas se débloquer lui-même via cette route");
        }

        // Récupérer l'utilisateur à débloquer
        const user = await prisma.user.findUnique({ 
            where: { id: targetId },
            select: { id: true, isBlocked: true, email: true },
        });

        if (!user) {
            throw new ApiError(404, `Utilisateur avec ID ${targetId} introuvable`);
        }

        // Vérifier que l'utilisateur est bien bloqué
        if (!user.isBlocked) {
            throw new ApiError(409, `L'utilisateur ${user.email} n'est pas bloqué`);
        }

        // Débloquer l'utilisateur
        return prisma.user.update({
            where: { id: targetId },
            data: { isBlocked: false },
            select: adminUserSelect,
        });
    },

    /**
     * Supprime définitivement un utilisateur de la base de données.
     * L'admin ne peut pas supprimer son propre compte.
     * Impossible de supprimer un autre admin.
     * @param {number} targetId - ID de l'utilisateur à supprimer
     * @param {number} adminId  - ID de l'admin qui fait la demande
     * @returns {Object} Utilisateur supprimé (pour confirmation)
     */
    async deleteUser(targetId, adminId) {
        validatePositiveId(targetId, "ID utilisateur");
        validatePositiveId(adminId, "ID administrateur");

        // Vérifier que l'admin ne supprime pas son propre compte
        if (targetId === adminId) {
            throw new ApiError(403, "Un admin ne peut pas supprimer son propre compte");
        }

        // Récupérer l'utilisateur à supprimer
        const user = await prisma.user.findUnique({ 
            where: { id: targetId },
            select: { id: true, role: true, email: true, brandId: true },
        });

        if (!user) {
            throw new ApiError(404, `Utilisateur avec ID ${targetId} introuvable`);
        }

        // Empêcher de supprimer un autre admin
        if (user.role === "admin") {
            throw new ApiError(403, "Impossible de supprimer un autre administrateur");
        }

        // Si l'utilisateur est une brand, supprimer aussi les quizmasters associés
        if (user.role === "brand") {
            await prisma.user.deleteMany({
                where: { brandId: targetId },
            });
        }

        // Supprimer l'utilisateur
        const deleted = await prisma.user.delete({ 
            where: { id: targetId },
            select: { 
                id: true, 
                email: true, 
                role: true,
                createdAt: true,
            },
        });

        return deleted;
    },

    /**
     * Génère un fichier CSV contenant tous les utilisateurs.
     * Champs exportés : id, name, email, role, isBlocked, createdAt
     * @returns {string} Contenu CSV en string
     */
    async exportUsersCsv() {
        const users = await prisma.user.findMany({
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isBlocked: true,
                createdAt: true,
            },
        });

        if (users.length === 0) {
            return "id,name,email,role,isBlocked,createdAt\n";
        }

        const fields = [
            { label: "id", value: "id" },
            { label: "name", value: "name" },
            { label: "email", value: "email" },
            { label: "role", value: "role" },
            { label: "isBlocked", value: "isBlocked" },
            { label: "createdAt", value: (row) => new Date(row.createdAt).toISOString() },
        ];

        const parser = new Parser({ fields });
        return parser.parse(users);
    },
};

module.exports = AdminService;
