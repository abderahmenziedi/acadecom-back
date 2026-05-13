const prisma = require("../config/prisma");
const bcrypt = require("bcrypt");
const ApiError = require("../utils/ApiError");

/**
 * Champs retournés pour un quizmaster (jamais le mot de passe).
 */
const quizmasterSelect = {
    id: true,
    name: true,
    email: true,
    role: true,
    isBlocked: true,
    brandId: true,
    brand: { select: { id: true, name: true, email: true } },
    createdAt: true,
};

/**
 * QuizmasterService — Logique métier pour la gestion des quizmasters par l'admin.
 */
const QuizmasterService = {
    /**
     * Crée un nouvel utilisateur avec le rôle "quizmaster", lié à un brand.
     * @param {{ name: string, email: string, password: string, brandId: number }} data
     */
    async create({ name, email, password, brandId }) {
        // Vérifier que l'email n'est pas déjà utilisé
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            throw new ApiError(409, "Cet email est déjà utilisé");
        }

        // Vérifier que le brand existe et a le rôle "brand"
        const brand = await prisma.user.findUnique({
            where: { id: brandId },
            select: { id: true, role: true },
        });

        if (!brand) {
            throw new ApiError(404, `Brand avec ID ${brandId} introuvable`);
        }
        if (brand.role !== "brand") {
            throw new ApiError(400, "L'utilisateur spécifié n'a pas le rôle 'brand'");
        }

        const hashed = await bcrypt.hash(password, 10);

        const quizmaster = await prisma.user.create({
            data: { name, email, password: hashed, role: "quizmaster", brandId },
            select: quizmasterSelect,
        });

        return quizmaster;
    },

    /**
     * Récupère la liste paginée de tous les quizmasters.
     * Filtre optionnel par brandId.
     * @param {{ brandId?: number, page: number, limit: number }} options
     */
    async getAll({ brandId, page = 1, limit = 10 }) {
        const where = { role: "quizmaster" };
        if (brandId) {
            where.brandId = brandId;
        }
        const skip = (page - 1) * limit;

        const [quizmasters, total] = await prisma.$transaction([
            prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                select: quizmasterSelect,
            }),
            prisma.user.count({ where }),
        ]);

        return {
            quizmasters,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    },

    /**
     * Récupère un quizmaster par son ID.
     * @param {number} id
     */
    async getById(id) {
        const quizmaster = await prisma.user.findUnique({
            where: { id },
            select: quizmasterSelect,
        });

        if (!quizmaster || quizmaster.role !== "quizmaster") {
            throw new ApiError(404, `Quizmaster avec ID ${id} introuvable`);
        }

        return quizmaster;
    },

    /**
     * Met à jour un quizmaster existant.
     * @param {number} id
     * @param {{ name?: string, email?: string, password?: string, brandId?: number }} data
     */
    async update(id, data) {
        const quizmaster = await prisma.user.findUnique({
            where: { id },
            select: { id: true, role: true },
        });

        if (!quizmaster || quizmaster.role !== "quizmaster") {
            throw new ApiError(404, `Quizmaster avec ID ${id} introuvable`);
        }

        // Vérifier l'unicité de l'email si modifié
        if (data.email) {
            const existing = await prisma.user.findUnique({ where: { email: data.email } });
            if (existing && existing.id !== id) {
                throw new ApiError(409, "Cet email est déjà utilisé par un autre utilisateur");
            }
        }

        // Vérifier que le nouveau brand existe si brandId est modifié
        if (data.brandId) {
            const brand = await prisma.user.findUnique({
                where: { id: data.brandId },
                select: { id: true, role: true },
            });
            if (!brand) {
                throw new ApiError(404, `Brand avec ID ${data.brandId} introuvable`);
            }
            if (brand.role !== "brand") {
                throw new ApiError(400, "L'utilisateur spécifié n'a pas le rôle 'brand'");
            }
        }

        // Hasher le nouveau mot de passe si fourni
        if (data.password) {
            data.password = await bcrypt.hash(data.password, 10);
        }

        const updated = await prisma.user.update({
            where: { id },
            data,
            select: quizmasterSelect,
        });

        return updated;
    },

    /**
     * Supprime un quizmaster.
     * @param {number} id
     */
    async delete(id) {
        const quizmaster = await prisma.user.findUnique({
            where: { id },
            select: { id: true, role: true, email: true },
        });

        if (!quizmaster || quizmaster.role !== "quizmaster") {
            throw new ApiError(404, `Quizmaster avec ID ${id} introuvable`);
        }

        // Supprimer les quizzes du quizmaster (cascade: questions, options, attempts, answers)
        const quizIds = (await prisma.quiz.findMany({
            where: { quizmasterId: id },
            select: { id: true },
        })).map(q => q.id);

        if (quizIds.length > 0) {
            await prisma.answer.deleteMany({ where: { attempt: { quizId: { in: quizIds } } } });
            const attemptIds = (await prisma.attempt.findMany({ where: { quizId: { in: quizIds } }, select: { id: true } })).map(a => a.id);
            if (attemptIds.length > 0) {
                await prisma.pointsHistory.deleteMany({ where: { attemptId: { in: attemptIds } } });
            }
            await prisma.attempt.deleteMany({ where: { quizId: { in: quizIds } } });
            await prisma.option.deleteMany({ where: { question: { quizId: { in: quizIds } } } });
            await prisma.question.deleteMany({ where: { quizId: { in: quizIds } } });
            await prisma.quiz.deleteMany({ where: { id: { in: quizIds } } });
        }

        // Supprimer les badges et notifications du quizmaster
        await prisma.userBadge.deleteMany({ where: { userId: id } });
        await prisma.notification.deleteMany({ where: { userId: id } });

        await prisma.user.delete({ where: { id } });

        return { id, email: quizmaster.email };
    },
};

module.exports = QuizmasterService;
