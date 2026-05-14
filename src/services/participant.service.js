const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const GamificationService = require("./gamification.service");
const NotificationService = require("./notification.service");
const ActivityLogService = require("./activityLog.service");

/**
 * Fires the post-quiz notifications (participant, quizmaster, brand) and audit log.
 * Best-effort: catches its own errors so it never breaks the response.
 */
async function fanoutQuizPlayed(userId, quizId, score, maxScore, gamification) {
    try {
        const [participant, quiz] = await Promise.all([
            prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
            prisma.quiz.findUnique({
                where: { id: quizId },
                select: { id: true, title: true, quizmasterId: true, brandId: true },
            }),
        ]);
        if (!quiz) return;

        await NotificationService.notifyParticipantQuizPlayed({
            userId,
            quizTitle: quiz.title,
            score,
            maxScore,
            xpEarned: gamification?.xpEarned || 0,
            couponsEarned: gamification?.couponsEarned || 0,
        });

        await NotificationService.notifyQuizPlayed({
            quizmasterId: quiz.quizmasterId,
            brandId: quiz.brandId,
            participantName: participant?.name || "Un participant",
            quizTitle: quiz.title,
            score,
            maxScore,
            quizId: quiz.id,
        });

        await ActivityLogService.log({
            actorId: userId,
            scopeId: quiz.brandId,
            action: "participant_take_quiz",
            entityType: "quiz",
            entityId: quiz.id,
            metadata: { score, maxScore, title: quiz.title },
        });

        // Milestone notifications to quizmaster (10/50/100/500 attempts).
        try {
            const count = await prisma.attempt.count({ where: { quizId: quiz.id, completedAt: { not: null } } });
            const milestones = [10, 50, 100, 500];
            if (milestones.includes(count)) {
                await NotificationService.notifyQuizStatsMilestone({
                    quizmasterId: quiz.quizmasterId,
                    quizTitle: quiz.title,
                    milestone: count,
                    quizId: quiz.id,
                });
            }
        } catch (_) { /* ignore */ }
    } catch (_) { /* ignore notification errors */ }
}

/**
 * ParticipantService — Logique métier complète du module Participant.
 */
const ParticipantService = {

    // ═══════════════════════════════════════════════════════════════
    // PROFIL
    // ═══════════════════════════════════════════════════════════════

    async getProfile(userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                totalPoints: true,
                xp: true,
                level: true,
                coupons: true,
                createdAt: true,
                _count: { select: { badges: true } },
            },
        });
        if (!user) throw new ApiError(404, "Participant introuvable");

        const levelName = GamificationService.getLevelName(user.level);
        return { ...user, levelName, badgeCount: user._count.badges };
    },

    async updateProfile(userId, data) {
        // Vérifier unicité de l'email si modifié
        if (data.email) {
            const existing = await prisma.user.findUnique({ where: { email: data.email } });
            if (existing && existing.id !== userId) {
                throw new ApiError(409, "Cet email est déjà utilisé");
            }
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                totalPoints: true,
                createdAt: true,
            },
        });
        return user;
    },

    // ═══════════════════════════════════════════════════════════════
    // STATISTIQUES
    // ═══════════════════════════════════════════════════════════════

    async getStats(userId) {
        const [user, aggregates, gamesPlayed] = await prisma.$transaction([
            prisma.user.findUnique({
                where: { id: userId },
                select: { totalPoints: true },
            }),
            prisma.attempt.aggregate({
                where: { userId, completedAt: { not: null } },
                _avg: { score: true },
                _max: { score: true },
                _sum: { score: true },
            }),
            prisma.attempt.count({
                where: { userId, completedAt: { not: null } },
            }),
        ]);

        // Calculer le rang global
        const rank = await prisma.user.count({
            where: {
                role: "participant",
                totalPoints: { gt: user.totalPoints },
            },
        }) + 1;

        return {
            gamesPlayed,
            totalScore: aggregates._sum.score || 0,
            averageScore: Math.round(aggregates._avg.score || 0),
            bestScore: aggregates._max.score || 0,
            totalPoints: user.totalPoints,
            rank,
        };
    },

    // ═══════════════════════════════════════════════════════════════
    // QUIZ DISPONIBLES
    // ═══════════════════════════════════════════════════════════════

    async listAvailableQuizzes({ page = 1, limit = 10, search }) {
        const where = {
            isActive: true,
            questions: { some: {} }, // Au moins une question
        };
        if (search) {
            where.OR = [
                { title: { contains: search } },
                { description: { contains: search } },
            ];
        }

        const skip = (page - 1) * limit;

        const [quizzes, total] = await prisma.$transaction([
            prisma.quiz.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    title: true,
                    description: true,
                    timeLimit: true,
                    pointsPerQuestion: true,
                    createdAt: true,
                    quizmaster: {
                        select: { id: true, name: true, email: true },
                    },
                    _count: { select: { questions: true, attempts: true } },
                },
            }),
            prisma.quiz.count({ where }),
        ]);

        return { quizzes, total, page, totalPages: Math.ceil(total / limit) };
    },

    // ═══════════════════════════════════════════════════════════════
    // DÉMARRER UNE TENTATIVE
    // ═══════════════════════════════════════════════════════════════

    async startAttempt(quizId, userId) {
        const quiz = await prisma.quiz.findUnique({
            where: { id: quizId },
            select: {
                id: true,
                isActive: true,
                title: true,
                description: true,
                timeLimit: true,
                shuffleQuestions: true,
                questions: {
                    orderBy: { order: "asc" },
                    select: {
                        id: true,
                        text: true,
                        points: true,
                        options: { select: { id: true, text: true } },
                    },
                },
            },
        });

        if (!quiz) throw new ApiError(404, `Quiz avec ID ${quizId} introuvable`);
        if (!quiz.isActive) throw new ApiError(400, "Ce quiz n'est pas encore activé");
        if (quiz.questions.length === 0) throw new ApiError(400, "Ce quiz n'a aucune question");

        // Empêcher les tentatives actives en doublon pour le même quiz
        const activeAttempt = await prisma.attempt.findFirst({
            where: { quizId, userId, completedAt: null },
        });
        if (activeAttempt) {
            throw new ApiError(409, "Vous avez déjà une tentative en cours pour ce quiz");
        }

        const maxScore = quiz.questions.reduce((sum, q) => sum + q.points, 0);

        const attempt = await prisma.attempt.create({
            data: { quizId, userId, maxScore },
            select: { id: true, quizId: true, maxScore: true, createdAt: true },
        });

        let questions = quiz.questions;
        if (quiz.shuffleQuestions) {
            questions = [...questions].sort(() => Math.random() - 0.5);
        }

        return {
            attempt,
            quiz: { id: quiz.id, title: quiz.title, description: quiz.description, timeLimit: quiz.timeLimit },
            questions,
        };
    },

    // ═══════════════════════════════════════════════════════════════
    // RÉPONDRE À UNE QUESTION (une par une)
    // ═══════════════════════════════════════════════════════════════

    async answerQuestion(attemptId, userId, { questionId, optionId }) {
        const attempt = await prisma.attempt.findUnique({
            where: { id: attemptId },
            select: {
                id: true,
                userId: true,
                completedAt: true,
                quizId: true,
            },
        });

        if (!attempt) throw new ApiError(404, "Tentative introuvable");
        if (attempt.userId !== userId) throw new ApiError(403, "Cette tentative ne vous appartient pas");
        if (attempt.completedAt) throw new ApiError(409, "Cette tentative est déjà terminée");

        // Vérifier que la question appartient au quiz
        const question = await prisma.question.findFirst({
            where: { id: questionId, quizId: attempt.quizId },
            select: {
                id: true,
                points: true,
                options: { select: { id: true, isCorrect: true } },
            },
        });
        if (!question) throw new ApiError(400, `Question ${questionId} n'appartient pas à ce quiz`);

        // Vérifier que l'option appartient à la question
        const option = question.options.find(o => o.id === optionId);
        if (!option) throw new ApiError(400, `Option ${optionId} n'appartient pas à la question ${questionId}`);

        // Vérifier que la question n'a pas déjà été répondue
        const alreadyAnswered = await prisma.answer.findFirst({
            where: { attemptId, questionId },
        });
        if (alreadyAnswered) throw new ApiError(409, `Vous avez déjà répondu à la question ${questionId}`);

        const isCorrect = option.isCorrect;

        const answer = await prisma.answer.create({
            data: { attemptId, questionId, optionId, isCorrect, userId },
            select: { id: true, questionId: true, optionId: true, isCorrect: true },
        });

        return answer;
    },

    // ═══════════════════════════════════════════════════════════════
    // TERMINER LA TENTATIVE (calcul du score + attribution des points)
    // ═══════════════════════════════════════════════════════════════

    async finishAttempt(attemptId, userId) {
        const attempt = await prisma.attempt.findUnique({
            where: { id: attemptId },
            select: {
                id: true,
                userId: true,
                completedAt: true,
                maxScore: true,
                createdAt: true,
                quizId: true,
                answers: {
                    select: { questionId: true, isCorrect: true },
                },
                quiz: {
                    select: {
                        title: true,
                        xpReward: true,
                        couponReward: true,
                        passingScore: true,
                        questions: { select: { id: true, points: true } },
                    },
                },
            },
        });

        if (!attempt) throw new ApiError(404, "Tentative introuvable");
        if (attempt.userId !== userId) throw new ApiError(403, "Cette tentative ne vous appartient pas");
        if (attempt.completedAt) throw new ApiError(409, "Cette tentative est déjà terminée");

        const questionPointsMap = new Map(
            attempt.quiz.questions.map(q => [q.id, q.points])
        );

        let score = 0;
        let correctAnswers = 0;
        for (const ans of attempt.answers) {
            if (ans.isCorrect) {
                score += questionPointsMap.get(ans.questionId) || 0;
                correctAnswers++;
            }
        }

        const now = new Date();
        const duration = Math.round((now.getTime() - attempt.createdAt.getTime()) / 1000);
        const percentage = attempt.maxScore > 0 ? Math.round((score / attempt.maxScore) * 100) : 0;

        const updatedAttempt = await prisma.attempt.update({
            where: { id: attemptId },
            data: { score, completedAt: now, duration },
            select: {
                id: true, quizId: true, score: true, maxScore: true,
                duration: true, completedAt: true, createdAt: true,
            },
        });

        // Process gamification (XP, levels, badges, coupons)
        const gamification = await GamificationService.processQuizCompletion(userId, attemptId, {
            score,
            maxScore: attempt.maxScore,
            duration,
            quizTitle: attempt.quiz.title,
            xpReward: attempt.quiz.xpReward || 10,
            couponReward: attempt.quiz.couponReward || 0,
            passingScore: attempt.quiz.passingScore || 50,
        });

        await fanoutQuizPlayed(userId, attempt.quizId, score, attempt.maxScore, gamification);

        return {
            ...updatedAttempt,
            totalQuestions: attempt.quiz.questions.length,
            answeredQuestions: attempt.answers.length,
            correctAnswers,
            percentage,
            pointsEarned: score,
            ...gamification,
        };
    },

    // ═══════════════════════════════════════════════════════════════
    // SOUMETTRE TOUTES LES RÉPONSES D'UN COUP + TERMINER
    // ═══════════════════════════════════════════════════════════════

    async submitAndFinish(attemptId, userId, answers) {
        const attempt = await prisma.attempt.findUnique({
            where: { id: attemptId },
            select: {
                id: true,
                userId: true,
                completedAt: true,
                maxScore: true,
                createdAt: true,
                quizId: true,
                quiz: {
                    select: {
                        title: true,
                        xpReward: true,
                        couponReward: true,
                        passingScore: true,
                        questions: {
                            select: {
                                id: true,
                                points: true,
                                options: { select: { id: true, isCorrect: true } },
                            },
                        },
                    },
                },
            },
        });

        if (!attempt) throw new ApiError(404, `Tentative avec ID ${attemptId} introuvable`);
        if (attempt.userId !== userId) throw new ApiError(403, "Cette tentative ne vous appartient pas");
        if (attempt.completedAt) throw new ApiError(409, "Cette tentative est déjà terminée");

        const existingCount = await prisma.answer.count({ where: { attemptId } });
        if (existingCount > 0) {
            throw new ApiError(409, "Les réponses ont déjà été soumises pour cette tentative");
        }

        const questionMap = new Map();
        for (const q of attempt.quiz.questions) {
            questionMap.set(q.id, {
                points: q.points,
                correctOptionIds: new Set(q.options.filter(o => o.isCorrect).map(o => o.id)),
                validOptionIds: new Set(q.options.map(o => o.id)),
            });
        }

        let score = 0;
        const answerRecords = [];

        for (const ans of answers) {
            const question = questionMap.get(ans.questionId);
            if (!question) throw new ApiError(400, `Question ID ${ans.questionId} n'appartient pas à ce quiz`);
            if (!question.validOptionIds.has(ans.optionId)) {
                throw new ApiError(400, `Option ID ${ans.optionId} n'appartient pas à la question ${ans.questionId}`);
            }
            const isCorrect = question.correctOptionIds.has(ans.optionId);
            if (isCorrect) score += question.points;
            answerRecords.push({ attemptId, questionId: ans.questionId, optionId: ans.optionId, isCorrect, userId });
        }

        const now = new Date();
        const duration = Math.round((now.getTime() - attempt.createdAt.getTime()) / 1000);
        const correctAnswers = answerRecords.filter(a => a.isCorrect).length;

        // Save answers + update attempt
        await prisma.answer.createMany({ data: answerRecords });
        const updatedAttempt = await prisma.attempt.update({
            where: { id: attemptId },
            data: { score, completedAt: now, duration },
            select: {
                id: true, quizId: true, score: true, maxScore: true,
                duration: true, completedAt: true, createdAt: true,
            },
        });

        // Process gamification
        const gamification = await GamificationService.processQuizCompletion(userId, attemptId, {
            score,
            maxScore: attempt.maxScore,
            duration,
            quizTitle: attempt.quiz.title,
            xpReward: attempt.quiz.xpReward || 10,
            couponReward: attempt.quiz.couponReward || 0,
            passingScore: attempt.quiz.passingScore || 50,
        });

        await fanoutQuizPlayed(userId, attempt.quizId, score, attempt.maxScore, gamification);

        return {
            ...updatedAttempt,
            totalQuestions: attempt.quiz.questions.length,
            correctAnswers,
            percentage: attempt.maxScore > 0 ? Math.round((score / attempt.maxScore) * 100) : 0,
            pointsEarned: score,
            ...gamification,
        };
    },

    // ═══════════════════════════════════════════════════════════════
    // RÉSULTAT D'UNE TENTATIVE
    // ═══════════════════════════════════════════════════════════════

    async getAttemptResult(attemptId, userId) {
        const attempt = await prisma.attempt.findUnique({
            where: { id: attemptId },
            select: {
                id: true,
                userId: true,
                quizId: true,
                score: true,
                maxScore: true,
                duration: true,
                completedAt: true,
                createdAt: true,
                quiz: { select: { title: true, description: true } },
                answers: {
                    select: {
                        questionId: true,
                        optionId: true,
                        isCorrect: true,
                        question: { select: { text: true, points: true } },
                        option: { select: { text: true } },
                    },
                },
            },
        });

        if (!attempt) throw new ApiError(404, "Tentative introuvable");
        if (attempt.userId !== userId) throw new ApiError(403, "Cette tentative ne vous appartient pas");
        if (!attempt.completedAt) throw new ApiError(400, "Cette tentative n'est pas encore terminée");

        const correctAnswers = attempt.answers.filter(a => a.isCorrect).length;
        const percentage = attempt.maxScore > 0 ? Math.round((attempt.score / attempt.maxScore) * 100) : 0;

        return {
            id: attempt.id,
            quizId: attempt.quizId,
            quiz: attempt.quiz,
            score: attempt.score,
            maxScore: attempt.maxScore,
            duration: attempt.duration,
            percentage,
            totalQuestions: attempt.answers.length,
            correctAnswers,
            completedAt: attempt.completedAt,
            createdAt: attempt.createdAt,
            answers: attempt.answers,
        };
    },

    // ═══════════════════════════════════════════════════════════════
    // HISTORIQUE DES TENTATIVES
    // ═══════════════════════════════════════════════════════════════

    async getAttempts(userId, { page = 1, limit = 10 }) {
        const where = { userId, completedAt: { not: null } };
        const skip = (page - 1) * limit;

        const [attempts, total] = await prisma.$transaction([
            prisma.attempt.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    quizId: true,
                    score: true,
                    maxScore: true,
                    duration: true,
                    completedAt: true,
                    createdAt: true,
                    quiz: { select: { title: true } },
                },
            }),
            prisma.attempt.count({ where }),
        ]);

        return { attempts, total, page, totalPages: Math.ceil(total / limit) };
    },

    async getAttemptDetail(attemptId, userId) {
        const attempt = await prisma.attempt.findUnique({
            where: { id: attemptId },
            select: {
                id: true,
                userId: true,
                quizId: true,
                score: true,
                maxScore: true,
                duration: true,
                completedAt: true,
                createdAt: true,
                quiz: { select: { title: true, description: true } },
                answers: {
                    select: {
                        id: true,
                        questionId: true,
                        optionId: true,
                        isCorrect: true,
                        question: { select: { text: true, points: true } },
                        option: { select: { text: true } },
                    },
                },
            },
        });

        if (!attempt) throw new ApiError(404, "Tentative introuvable");
        if (attempt.userId !== userId) throw new ApiError(403, "Cette tentative ne vous appartient pas");

        return attempt;
    },

    // ═══════════════════════════════════════════════════════════════
    // WALLET / POINTS
    // ═══════════════════════════════════════════════════════════════

    async getWallet(userId) {
        const [user, earned, redeemed] = await prisma.$transaction([
            prisma.user.findUnique({
                where: { id: userId },
                select: { totalPoints: true },
            }),
            prisma.pointsHistory.aggregate({
                where: { userId, points: { gt: 0 } },
                _sum: { points: true },
            }),
            prisma.pointsHistory.aggregate({
                where: { userId, points: { lt: 0 } },
                _sum: { points: true },
            }),
        ]);

        return {
            totalPoints: user.totalPoints,
            pointsEarned: earned._sum.points || 0,
            pointsRedeemed: Math.abs(redeemed._sum.points || 0),
        };
    },

    async getPointsHistory(userId, { page = 1, limit = 10 }) {
        const where = { userId };
        const skip = (page - 1) * limit;

        const [history, total] = await prisma.$transaction([
            prisma.pointsHistory.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    points: true,
                    reason: true,
                    attemptId: true,
                    createdAt: true,
                },
            }),
            prisma.pointsHistory.count({ where }),
        ]);

        return { history, total, page, totalPages: Math.ceil(total / limit) };
    },

    // ═══════════════════════════════════════════════════════════════
    // RECOMMANDATIONS
    // ═══════════════════════════════════════════════════════════════

    async getRecommendations(userId) {
        // Quizzes que le participant n'a pas encore terminés, triés par popularité
        const completedQuizIds = await prisma.attempt.findMany({
            where: { userId, completedAt: { not: null } },
            select: { quizId: true },
            distinct: ["quizId"],
        });

        const excludeIds = completedQuizIds.map(a => a.quizId);

        const quizzes = await prisma.quiz.findMany({
            where: {
                isActive: true,
                questions: { some: {} },
                ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
            },
            orderBy: { attempts: { _count: "desc" } },
            take: 10,
            select: {
                id: true,
                title: true,
                description: true,
                timeLimit: true,
                pointsPerQuestion: true,
                _count: { select: { questions: true, attempts: true } },
            },
        });

        return quizzes;
    },
};

module.exports = ParticipantService;
