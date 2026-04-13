const prisma = require("../config/prisma");
const bcrypt = require("bcrypt");
const ApiError = require("../utils/ApiError");

/**
 * Champs retournés pour un brand (jamais le mot de passe).
 */
const brandSelect = {
    id: true,
    name: true,
    email: true,
    role: true,
    isBlocked: true,
    createdAt: true,
    _count: { select: { quizmasters: true } },
};

/**
 * BrandService — Logique métier pour la gestion des brands par l'admin.
 */
const BrandService = {
    /**
     * Crée un nouvel utilisateur avec le rôle "brand".
     * @param {{ name: string, email: string, password: string }} data
     */
    async create({ name, email, password }) {
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            throw new ApiError(409, "Cet email est déjà utilisé");
        }

        const hashed = await bcrypt.hash(password, 10);

        const brand = await prisma.user.create({
            data: { name, email, password: hashed, role: "brand" },
            select: brandSelect,
        });

        return brand;
    },

    /**
     * Récupère la liste paginée de tous les brands.
     * @param {{ page: number, limit: number }} options
     */
    async getAll({ page = 1, limit = 10 }) {
        const where = { role: "brand" };
        const skip = (page - 1) * limit;

        const [brands, total] = await prisma.$transaction([
            prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                select: brandSelect,
            }),
            prisma.user.count({ where }),
        ]);

        return {
            brands,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    },

    /**
     * Récupère un brand par son ID.
     * @param {number} id
     */
    async getById(id) {
        const brand = await prisma.user.findUnique({
            where: { id },
            select: {
                ...brandSelect,
                quizmasters: {
                    select: { id: true, name: true, email: true, createdAt: true },
                },
            },
        });

        if (!brand || brand.role !== "brand") {
            throw new ApiError(404, `Brand avec ID ${id} introuvable`);
        }

        return brand;
    },

    /**
     * Met à jour un brand existant.
     * @param {number} id
     * @param {{ name?: string, email?: string, password?: string }} data
     */
    async update(id, data) {
        const brand = await prisma.user.findUnique({
            where: { id },
            select: { id: true, role: true },
        });

        if (!brand || brand.role !== "brand") {
            throw new ApiError(404, `Brand avec ID ${id} introuvable`);
        }

        // Vérifier l'unicité de l'email si modifié
        if (data.email) {
            const existing = await prisma.user.findUnique({ where: { email: data.email } });
            if (existing && existing.id !== id) {
                throw new ApiError(409, "Cet email est déjà utilisé par un autre utilisateur");
            }
        }

        // Hasher le nouveau mot de passe si fourni
        if (data.password) {
            data.password = await bcrypt.hash(data.password, 10);
        }

        const updated = await prisma.user.update({
            where: { id },
            data,
            select: brandSelect,
        });

        return updated;
    },

    /**
     * Supprime un brand. Échoue si des quizmasters sont encore liés.
     * @param {number} id
     */
    async delete(id) {
        const brand = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                role: true,
                email: true,
                _count: { select: { quizmasters: true } },
            },
        });

        if (!brand || brand.role !== "brand") {
            throw new ApiError(404, `Brand avec ID ${id} introuvable`);
        }

        if (brand._count.quizmasters > 0) {
            throw new ApiError(
                409,
                `Impossible de supprimer ce brand : ${brand._count.quizmasters} quizmaster(s) encore lié(s). Supprimez-les d'abord.`
            );
        }

        await prisma.user.delete({ where: { id } });

        return { id, email: brand.email };
    },
};

module.exports = BrandService;
