const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const NotificationService = require("./notification.service");
const ActivityLogService = require("./activityLog.service");

/**
 * Champs retournés pour un quiz.
 */
const quizSelect = {
    id: true,
    title: true,
    description: true,
    brandId: true,
    quizmasterId: true,
    timeLimit: true,
    pointsPerQuestion: true,
    shuffleQuestions: true,
    isActive: true,
    imageUrl: true,
    category: true,
    difficulty: true,
    passingScore: true,
    xpReward: true,
    couponReward: true,
    maxAttempts: true,
    createdAt: true,
    updatedAt: true,
    _count: { select: { questions: true, attempts: true } },
};

/**
 * Vérifie qu'un quiz appartient au quizmaster (via quizmasterId).
 */
async function ensureQuizOwnership(quizId, quizmasterId) {
    const quiz = await prisma.quiz.findUnique({
        where: { id: quizId },
        select: { id: true, quizmasterId: true, isActive: true },
    });
    if (!quiz) {
        throw new ApiError(404, `Quiz avec ID ${quizId} introuvable`);
    }
    if (quiz.quizmasterId !== quizmasterId) {
        throw new ApiError(403, "Vous n'avez pas accès à ce quiz");
    }
    return quiz;
}

/**
 * QuizService — Logique métier pour la gestion des quizzes par le quizmaster.
 */
const QuizService = {
    /**
     * Crée un nouveau quiz lié au quizmaster et à son brand.
     */
    async create(data, quizmasterId, brandId) {
        const quiz = await prisma.quiz.create({
            data: {
                title: data.title,
                description: data.description || null,
                timeLimit: data.timeLimit || null,
                pointsPerQuestion: data.pointsPerQuestion ?? 1,
                shuffleQuestions: data.shuffleQuestions ?? false,
                imageUrl: data.imageUrl || null,
                category: data.category || null,
                difficulty: data.difficulty || "medium",
                passingScore: data.passingScore ?? 50,
                xpReward: data.xpReward ?? 10,
                couponReward: data.couponReward ?? 0,
                quizmasterId,
                brandId,
            },
            select: quizSelect,
        });

        const qm = await prisma.user.findUnique({
            where: { id: quizmasterId },
            select: { name: true },
        });
        await NotificationService.notifyQuizCreated({
            brandId,
            quizmasterName: qm?.name || "Un quizmaster",
            quizTitle: quiz.title,
            quizId: quiz.id,
        });
        await ActivityLogService.log({
            actorId: quizmasterId,
            scopeId: brandId,
            action: "quizmaster_create_quiz",
            entityType: "quiz",
            entityId: quiz.id,
            metadata: { title: quiz.title },
        });
        return quiz;
    },

    /**
     * Récupère tous les quizzes du quizmaster (paginés).
     */
    async getAll(quizmasterId, { page = 1, limit = 10, isActive }) {
        const where = { quizmasterId };
        if (typeof isActive === "boolean") {
            where.isActive = isActive;
        }
        const skip = (page - 1) * limit;

        const [quizzes, total] = await prisma.$transaction([
            prisma.quiz.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                select: quizSelect,
            }),
            prisma.quiz.count({ where }),
        ]);

        return {
            quizzes,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    },

    /**
     * Récupère un quiz par ID (avec questions et options).
     */
    async getById(quizId, quizmasterId) {
        await ensureQuizOwnership(quizId, quizmasterId);

        const quiz = await prisma.quiz.findUnique({
            where: { id: quizId },
            select: {
                ...quizSelect,
                questions: {
                    orderBy: { order: "asc" },
                    select: {
                        id: true,
                        text: true,
                        points: true,
                        order: true,
                        options: {
                            select: { id: true, text: true, isCorrect: true },
                        },
                    },
                },
            },
        });

        return quiz;
    },

    /**
     * Met à jour un quiz.
     */
    async update(quizId, data, quizmasterId) {
        const quiz = await ensureQuizOwnership(quizId, quizmasterId);

        // Empêcher la modification de certains champs si le quiz est actif
        // (on autorise seulement isActive pour désactiver)
        if (quiz.isActive && data.isActive !== false) {
            const modifiableWhenActive = ["isActive"];
            const attemptedFields = Object.keys(data);
            const forbidden = attemptedFields.filter(f => !modifiableWhenActive.includes(f));
            if (forbidden.length > 0) {
                throw new ApiError(400, `Impossible de modifier un quiz actif. Désactivez-le d'abord. Champs bloqués : ${forbidden.join(", ")}`);
            }
        }

        const updated = await prisma.quiz.update({
            where: { id: quizId },
            data,
            select: quizSelect,
        });

        await ActivityLogService.log({
            actorId: quizmasterId,
            scopeId: updated.brandId,
            action: "quizmaster_update_quiz",
            entityType: "quiz",
            entityId: quizId,
            metadata: { title: updated.title, fields: Object.keys(data) },
        });

        return updated;
    },

    /**
     * Supprime un quiz (cascade : questions, options, attempts, answers).
     */
    async delete(quizId, quizmasterId) {
        await ensureQuizOwnership(quizId, quizmasterId);

        const full = await prisma.quiz.findUnique({
            where: { id: quizId },
            select: { id: true, title: true, brandId: true, isActive: true },
        });

        if (full.isActive) {
            throw new ApiError(400, "Impossible de supprimer un quiz actif. Désactivez-le d'abord.");
        }

        const qm = await prisma.user.findUnique({
            where: { id: quizmasterId },
            select: { name: true },
        });

        await prisma.quiz.delete({ where: { id: quizId } });

        await NotificationService.notifyQuizDeleted({
            brandId: full.brandId,
            quizmasterName: qm?.name,
            quizTitle: full.title,
        });
        await ActivityLogService.log({
            actorId: quizmasterId,
            scopeId: full.brandId,
            action: "quizmaster_delete_quiz",
            entityType: "quiz",
            entityId: quizId,
            metadata: { title: full.title },
        });

        return { id: quizId };
    },

    /**
     * Démarre une tentative de quiz pour un participant.
     */
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
                        options: {
                            select: { id: true, text: true },
                        },
                    },
                },
            },
        });

        if (!quiz) {
            throw new ApiError(404, `Quiz avec ID ${quizId} introuvable`);
        }
        if (!quiz.isActive) {
            throw new ApiError(400, "Ce quiz n'est pas encore activé");
        }
        if (quiz.questions.length === 0) {
            throw new ApiError(400, "Ce quiz n'a aucune question");
        }

        // Calculer le score max
        const maxScore = quiz.questions.reduce((sum, q) => sum + q.points, 0);

        // Créer la tentative
        const attempt = await prisma.attempt.create({
            data: { quizId, userId, maxScore },
            select: { id: true, quizId: true, maxScore: true, createdAt: true },
        });

        // Mélanger les questions si activé
        let questions = quiz.questions;
        if (quiz.shuffleQuestions) {
            questions = [...questions].sort(() => Math.random() - 0.5);
        }

        return {
            attempt,
            quiz: {
                id: quiz.id,
                title: quiz.title,
                description: quiz.description,
                timeLimit: quiz.timeLimit,
            },
            questions,
        };
    },

    /**
     * Soumet les réponses et calcule le score.
     */
    async submitAnswers(attemptId, userId, answers) {
        const attempt = await prisma.attempt.findUnique({
            where: { id: attemptId },
            select: {
                id: true,
                userId: true,
                score: true,
                quiz: {
                    select: {
                        id: true,
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

        if (!attempt) {
            throw new ApiError(404, `Tentative avec ID ${attemptId} introuvable`);
        }
        if (attempt.userId !== userId) {
            throw new ApiError(403, "Cette tentative ne vous appartient pas");
        }

        // Vérifier que la tentative n'a pas déjà des réponses
        const existingAnswers = await prisma.answer.count({ where: { attemptId } });
        if (existingAnswers > 0) {
            throw new ApiError(409, "Les réponses ont déjà été soumises pour cette tentative");
        }

        // Construire une map questionId -> { points, correctOptionIds }
        const questionMap = new Map();
        for (const q of attempt.quiz.questions) {
            questionMap.set(q.id, {
                points: q.points,
                correctOptionIds: new Set(q.options.filter(o => o.isCorrect).map(o => o.id)),
                validOptionIds: new Set(q.options.map(o => o.id)),
            });
        }

        // Valider et calculer le score
        let score = 0;
        const answerRecords = [];

        for (const ans of answers) {
            const question = questionMap.get(ans.questionId);
            if (!question) {
                throw new ApiError(400, `Question ID ${ans.questionId} n'appartient pas à ce quiz`);
            }
            if (!question.validOptionIds.has(ans.optionId)) {
                throw new ApiError(400, `Option ID ${ans.optionId} n'appartient pas à la question ${ans.questionId}`);
            }

            const isCorrect = question.correctOptionIds.has(ans.optionId);
            if (isCorrect) score += question.points;

            answerRecords.push({
                attemptId,
                questionId: ans.questionId,
                optionId: ans.optionId,
                isCorrect,
                userId,
            });
        }

        // Sauvegarder les réponses et mettre à jour le score dans une transaction
        const [, updatedAttempt] = await prisma.$transaction([
            prisma.answer.createMany({ data: answerRecords }),
            prisma.attempt.update({
                where: { id: attemptId },
                data: { score },
                select: {
                    id: true,
                    quizId: true,
                    score: true,
                    maxScore: true,
                    createdAt: true,
                },
            }),
        ]);

        return {
            ...updatedAttempt,
            totalQuestions: attempt.quiz.questions.length,
            correctAnswers: answerRecords.filter(a => a.isCorrect).length,
            percentage: Math.round((score / updatedAttempt.maxScore) * 100),
        };
    },
};

module.exports = QuizService;
