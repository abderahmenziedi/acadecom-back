const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");

/**
 * BrandAnalyticsService — Statistiques et analytics pour les brands.
 */
const BrandAnalyticsService = {
    /**
     * Analytics d'un brand spécifique (par ID).
     * Accessible par admin (n'importe quel brand) ou par le brand lui-même.
     */
    async getBrandAnalytics(brandId) {
        // Vérifier que le brand existe
        const brand = await prisma.user.findUnique({
            where: { id: brandId },
            select: { id: true, name: true, role: true, industry: true },
        });

        if (!brand || brand.role !== "brand") {
            throw new ApiError(404, `Brand avec ID ${brandId} introuvable`);
        }

        // Quizmasters liés à ce brand
        const quizmasters = await prisma.user.findMany({
            where: { brandId, role: "quizmaster" },
            select: { id: true },
        });
        const quizmasterIds = quizmasters.map(q => q.id);
        const totalQuizmasters = quizmasterIds.length;

        // Quizzes créés par ces quizmasters
        const quizzes = await prisma.quiz.findMany({
            where: { brandId },
            select: {
                id: true,
                title: true,
                isActive: true,
                _count: { select: { questions: true, attempts: true } },
            },
        });

        const totalQuizzes = quizzes.length;
        const activeQuizzes = quizzes.filter(q => q.isActive).length;
        const totalQuestions = quizzes.reduce((sum, q) => sum + q._count.questions, 0);
        const totalAttempts = quizzes.reduce((sum, q) => sum + q._count.attempts, 0);

        // Participants uniques
        const uniqueParticipants = await prisma.attempt.findMany({
            where: { quiz: { brandId } },
            select: { userId: true },
            distinct: ["userId"],
        });
        const totalParticipants = uniqueParticipants.length;

        // Score moyen global
        const allAttempts = await prisma.attempt.findMany({
            where: { quiz: { brandId } },
            select: { score: true, maxScore: true },
        });

        let averageScorePercentage = 0;
        if (allAttempts.length > 0) {
            const totalPercentage = allAttempts.reduce((sum, a) => {
                return sum + (a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0);
            }, 0);
            averageScorePercentage = Math.round(totalPercentage / allAttempts.length);
        }

        // Top 5 quizzes les plus joués
        const topQuizzes = [...quizzes]
            .sort((a, b) => b._count.attempts - a._count.attempts)
            .slice(0, 5)
            .map(q => ({
                id: q.id,
                title: q.title,
                isActive: q.isActive,
                questions: q._count.questions,
                attempts: q._count.attempts,
            }));

        return {
            brand: { id: brand.id, name: brand.name, industry: brand.industry },
            totalQuizmasters,
            totalQuizzes,
            activeQuizzes,
            totalQuestions,
            totalAttempts,
            totalParticipants,
            averageScorePercentage,
            topQuizzes,
        };
    },

    /**
     * Tableau de bord du brand connecté.
     * Agrège toutes les données liées à ce brand.
     */
    async getDashboard(brandId) {
        // Vérifier que le brand existe
        const brand = await prisma.user.findUnique({
            where: { id: brandId },
            select: { id: true, name: true, role: true, industry: true, description: true, createdAt: true },
        });

        if (!brand || brand.role !== "brand") {
            throw new ApiError(404, "Brand introuvable");
        }

        // Quizmasters
        const quizmasters = await prisma.user.findMany({
            where: { brandId, role: "quizmaster" },
            select: {
                id: true,
                name: true,
                email: true,
                _count: { select: { quizzes: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        // Quizzes
        const quizzes = await prisma.quiz.findMany({
            where: { brandId },
            select: {
                id: true,
                title: true,
                isActive: true,
                createdAt: true,
                quizmaster: { select: { id: true, name: true } },
                _count: { select: { questions: true, attempts: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        const totalQuizzes = quizzes.length;
        const activeQuizzes = quizzes.filter(q => q.isActive).length;
        const totalAttempts = quizzes.reduce((sum, q) => sum + q._count.attempts, 0);

        // Participants uniques
        const uniqueParticipants = await prisma.attempt.findMany({
            where: { quiz: { brandId } },
            select: { userId: true },
            distinct: ["userId"],
        });

        // Score moyen
        const allAttempts = await prisma.attempt.findMany({
            where: { quiz: { brandId } },
            select: { score: true, maxScore: true },
        });

        let averageScorePercentage = 0;
        if (allAttempts.length > 0) {
            const totalPercentage = allAttempts.reduce((sum, a) => {
                return sum + (a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0);
            }, 0);
            averageScorePercentage = Math.round(totalPercentage / allAttempts.length);
        }

        return {
            brand: {
                id: brand.id,
                name: brand.name,
                industry: brand.industry,
                description: brand.description,
                createdAt: brand.createdAt,
            },
            summary: {
                totalQuizmasters: quizmasters.length,
                totalQuizzes,
                activeQuizzes,
                totalAttempts,
                totalParticipants: uniqueParticipants.length,
                averageScorePercentage,
            },
            quizmasters: quizmasters.map(qm => ({
                id: qm.id,
                name: qm.name,
                email: qm.email,
                totalQuizzes: qm._count.quizzes,
            })),
            recentQuizzes: quizzes.slice(0, 10).map(q => ({
                id: q.id,
                title: q.title,
                isActive: q.isActive,
                quizmaster: q.quizmaster,
                questions: q._count.questions,
                attempts: q._count.attempts,
                createdAt: q.createdAt,
            })),
        };
    },
};

module.exports = BrandAnalyticsService;
