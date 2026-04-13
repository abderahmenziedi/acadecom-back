const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");

/**
 * LeaderboardService — Classements global et par quiz.
 */
const LeaderboardService = {

    /**
     * Classement global basé sur totalPoints de chaque participant.
     */
    async getGlobal({ page = 1, limit = 20 }) {
        const skip = (page - 1) * limit;

        const [participants, total] = await prisma.$transaction([
            prisma.user.findMany({
                where: { role: "participant" },
                orderBy: { totalPoints: "desc" },
                skip,
                take: limit,
                select: {
                    id: true,
                    name: true,
                    totalPoints: true,
                    _count: { select: { attempts: true } },
                },
            }),
            prisma.user.count({ where: { role: "participant" } }),
        ]);

        const leaderboard = participants.map((p, i) => ({
            rank: skip + i + 1,
            id: p.id,
            name: p.name,
            totalPoints: p.totalPoints,
            gamesPlayed: p._count.attempts,
        }));

        return { leaderboard, total, page, totalPages: Math.ceil(total / limit) };
    },

    /**
     * Classement par quiz — meilleur score de chaque participant, trié par score desc puis durée asc.
     */
    async getByQuiz(quizId, { page = 1, limit = 20 }) {
        // Vérifier que le quiz existe
        const quiz = await prisma.quiz.findUnique({
            where: { id: quizId },
            select: { id: true, title: true, isActive: true },
        });
        if (!quiz) throw new ApiError(404, `Quiz avec ID ${quizId} introuvable`);

        // Récupérer toutes les tentatives terminées pour ce quiz
        const attempts = await prisma.attempt.findMany({
            where: { quizId, completedAt: { not: null } },
            orderBy: [{ score: "desc" }, { duration: "asc" }],
            select: {
                userId: true,
                score: true,
                maxScore: true,
                duration: true,
                completedAt: true,
                user: { select: { id: true, name: true } },
            },
        });

        // Dédoublonner par userId (garder la meilleure tentative)
        const seen = new Set();
        const all = [];
        for (const a of attempts) {
            if (!seen.has(a.userId)) {
                seen.add(a.userId);
                all.push({
                    id: a.user.id,
                    name: a.user.name,
                    score: a.score,
                    maxScore: a.maxScore,
                    percentage: a.maxScore > 0 ? Math.round((a.score / a.maxScore) * 100) : 0,
                    duration: a.duration,
                });
            }
        }

        const total = all.length;
        const skip = (page - 1) * limit;
        const leaderboard = all.slice(skip, skip + limit).map((entry, i) => ({
            rank: skip + i + 1,
            ...entry,
        }));

        return {
            quiz: { id: quiz.id, title: quiz.title },
            leaderboard,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    },
};

module.exports = LeaderboardService;
