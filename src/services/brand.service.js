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
    industry: true,
    description: true,
    isBlocked: true,
    createdAt: true,
    _count: { select: { quizmasters: true } },
};

/**
 * BrandService — Logique métier pour la gestion des brands.
 * Admin CRUD + Brand self-service.
 */
const BrandService = {
    // ═══════════════════════════════════════════════════════
    // ADMIN CRUD
    // ═══════════════════════════════════════════════════════

    /**
     * Crée un nouvel utilisateur avec le rôle "brand".
     */
    async create({ name, email, password, industry, description }) {
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            throw new ApiError(409, "Cet email est déjà utilisé");
        }

        const hashed = await bcrypt.hash(password, 10);

        const brand = await prisma.user.create({
            data: {
                name,
                email,
                password: hashed,
                role: "brand",
                industry: industry || null,
                description: description || null,
            },
            select: brandSelect,
        });

        return brand;
    },

    /**
     * Récupère la liste paginée de tous les brands avec filtres.
     */
    async getAll({ page = 1, limit = 10, industry, search }) {
        const where = { role: "brand" };

        if (industry) {
            where.industry = { contains: industry };
        }
        if (search) {
            where.OR = [
                { name: { contains: search } },
                { email: { contains: search } },
            ];
        }

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
     * Récupère un brand par son ID (avec ses quizmasters).
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
     * Met à jour un brand existant (admin — tous les champs).
     */
    async update(id, data) {
        const brand = await prisma.user.findUnique({
            where: { id },
            select: { id: true, role: true },
        });

        if (!brand || brand.role !== "brand") {
            throw new ApiError(404, `Brand avec ID ${id} introuvable`);
        }

        if (data.email) {
            const existing = await prisma.user.findUnique({ where: { email: data.email } });
            if (existing && existing.id !== id) {
                throw new ApiError(409, "Cet email est déjà utilisé par un autre utilisateur");
            }
        }

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

    // ═══════════════════════════════════════════════════════
    // BRAND SELF-SERVICE
    // ═══════════════════════════════════════════════════════

    /**
     * Récupère le profil du brand connecté (dashboard info).
     */
    async getProfile(brandId) {
        const brand = await prisma.user.findUnique({
            where: { id: brandId },
            select: {
                ...brandSelect,
                quizmasters: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        createdAt: true,
                        _count: { select: { quizzes: true } },
                    },
                },
            },
        });

        if (!brand || brand.role !== "brand") {
            throw new ApiError(404, "Profil brand introuvable");
        }

        return brand;
    },

    /**
     * Met à jour le profil du brand (champs limités : name, industry, description).
     */
    async updateProfile(brandId, data) {
        const brand = await prisma.user.findUnique({
            where: { id: brandId },
            select: { id: true, role: true },
        });

        if (!brand || brand.role !== "brand") {
            throw new ApiError(404, "Profil brand introuvable");
        }

        const updated = await prisma.user.update({
            where: { id: brandId },
            data,
            select: brandSelect,
        });

        return updated;
    },

    /**
     * Récupère les quizmasters liés à ce brand.
     */
    async getQuizmasters(brandId) {
        const brand = await prisma.user.findUnique({
            where: { id: brandId },
            select: { id: true, role: true },
        });

        if (!brand || brand.role !== "brand") {
            throw new ApiError(404, "Brand introuvable");
        }

        const quizmasters = await prisma.user.findMany({
            where: { brandId, role: "quizmaster" },
            select: {
                id: true,
                name: true,
                email: true,
                createdAt: true,
                _count: { select: { quizzes: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        return quizmasters;
    },

    /**
     * Récupère les quizzes liés à ce brand (via ses quizmasters).
     */
    async getQuizzes(brandId) {
        const brand = await prisma.user.findUnique({
            where: { id: brandId },
            select: { id: true, role: true },
        });

        if (!brand || brand.role !== "brand") {
            throw new ApiError(404, "Brand introuvable");
        }

        const quizzes = await prisma.quiz.findMany({
            where: { brandId },
            select: {
                id: true,
                title: true,
                description: true,
                isActive: true,
                timeLimit: true,
                pointsPerQuestion: true,
                createdAt: true,
                updatedAt: true,
                quizmaster: {
                    select: { id: true, name: true, email: true },
                },
                _count: { select: { questions: true, attempts: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        return quizzes;
    },
};

module.exports = BrandService;
