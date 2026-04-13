const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");

/**
 * AnalyticsService — Statistiques et analytics pour le quizmaster.
 */
const AnalyticsService = {
    /**
     * Récupère les analytics d'un quiz spécifique.
     */
    async getQuizAnalytics(quizId, quizmasterId) {
        // Vérifier ownership
        const quiz = await prisma.quiz.findUnique({
            where: { id: quizId },
            select: {
                id: true,
                title: true,
                quizmasterId: true,
                isActive: true,
                _count: { select: { questions: true } },
            },
        });

        if (!quiz) {
            throw new ApiError(404, `Quiz avec ID ${quizId} introuvable`);
        }
        if (quiz.quizmasterId !== quizmasterId) {
            throw new ApiError(403, "Vous n'avez pas accès à ce quiz");
        }

        // Statistiques des tentatives
        const attempts = await prisma.attempt.findMany({
            where: { quizId },
            select: { score: true, maxScore: true, createdAt: true },
        });

        const totalAttempts = attempts.length;

        if (totalAttempts === 0) {
            return {
                quiz: { id: quiz.id, title: quiz.title, totalQuestions: quiz._count.questions },
                totalAttempts: 0,
                averageScore: 0,
                averagePercentage: 0,
                highestScore: 0,
                lowestScore: 0,
                questionStats: [],
            };
        }

        const scores = attempts.map(a => a.score);
        const maxScore = attempts[0].maxScore;
        const averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / totalAttempts * 100) / 100;
        const averagePercentage = maxScore > 0 ? Math.round((averageScore / maxScore) * 100) : 0;
        const highestScore = Math.max(...scores);
        const lowestScore = Math.min(...scores);

        // Stats par question : taux de bonne réponse
        const questionStats = await prisma.question.findMany({
            where: { quizId },
            select: {
                id: true,
                text: true,
                points: true,
                _count: { select: { answers: true } },
                answers: {
                    select: { isCorrect: true },
                },
            },
            orderBy: { order: "asc" },
        });

        const formattedStats = questionStats.map((q) => {
            const totalAnswers = q.answers.length;
            const correctAnswers = q.answers.filter(a => a.isCorrect).length;
            return {
                questionId: q.id,
                text: q.text,
                points: q.points,
                totalAnswers,
                correctAnswers,
                successRate: totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0,
            };
        });

        return {
            quiz: { id: quiz.id, title: quiz.title, totalQuestions: quiz._count.questions },
            totalAttempts,
            averageScore,
            averagePercentage,
            highestScore,
            lowestScore,
            questionStats: formattedStats,
        };
    },

    /**
     * Dashboard global du quizmaster.
     */
    async getDashboard(quizmasterId) {
        // Tous les quizzes du quizmaster
        const quizzes = await prisma.quiz.findMany({
            where: { quizmasterId },
            select: {
                id: true,
                title: true,
                isActive: true,
                createdAt: true,
                _count: { select: { questions: true, attempts: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        const totalQuizzes = quizzes.length;
        const activeQuizzes = quizzes.filter(q => q.isActive).length;
        const totalAttempts = quizzes.reduce((sum, q) => sum + q._count.attempts, 0);
        const totalQuestions = quizzes.reduce((sum, q) => sum + q._count.questions, 0);

        // Score moyen global
        const allAttempts = await prisma.attempt.findMany({
            where: {
                quiz: { quizmasterId },
            },
            select: { score: true, maxScore: true },
        });

        let globalAveragePercentage = 0;
        if (allAttempts.length > 0) {
            const totalPercentage = allAttempts.reduce((sum, a) => {
                return sum + (a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0);
            }, 0);
            globalAveragePercentage = Math.round(totalPercentage / allAttempts.length);
        }

        // Top 5 quizzes les plus joués
        const topQuizzes = [...quizzes]
            .sort((a, b) => b._count.attempts - a._count.attempts)
            .slice(0, 5)
            .map(q => ({
                id: q.id,
                title: q.title,
                attempts: q._count.attempts,
                questions: q._count.questions,
                isActive: q.isActive,
            }));

        return {
            totalQuizzes,
            activeQuizzes,
            totalQuestions,
            totalAttempts,
            globalAveragePercentage,
            topQuizzes,
            recentQuizzes: quizzes.slice(0, 5).map(q => ({
                id: q.id,
                title: q.title,
                isActive: q.isActive,
                questions: q._count.questions,
                attempts: q._count.attempts,
                createdAt: q.createdAt,
            })),
        };
    },
};

module.exports = AnalyticsService;
