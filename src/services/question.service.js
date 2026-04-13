const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");

/**
 * Vérifie qu'un quiz appartient au quizmaster.
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
 * Vérifie qu'une question appartient à un quiz du quizmaster.
 */
async function ensureQuestionOwnership(questionId, quizmasterId) {
    const question = await prisma.question.findUnique({
        where: { id: questionId },
        select: {
            id: true,
            quizId: true,
            quiz: { select: { quizmasterId: true, isActive: true } },
        },
    });
    if (!question) {
        throw new ApiError(404, `Question avec ID ${questionId} introuvable`);
    }
    if (question.quiz.quizmasterId !== quizmasterId) {
        throw new ApiError(403, "Vous n'avez pas accès à cette question");
    }
    return question;
}

/**
 * QuestionService — Logique métier pour la gestion des questions.
 */
const QuestionService = {
    /**
     * Ajoute une question (avec options) à un quiz.
     */
    async create(quizId, data, quizmasterId) {
        const quiz = await ensureQuizOwnership(quizId, quizmasterId);

        if (quiz.isActive) {
            throw new ApiError(400, "Impossible d'ajouter des questions à un quiz actif. Désactivez-le d'abord.");
        }

        const question = await prisma.question.create({
            data: {
                quizId,
                text: data.text,
                points: data.points ?? 1,
                order: data.order ?? 0,
                options: {
                    create: data.options.map((opt) => ({
                        text: opt.text,
                        isCorrect: opt.isCorrect ?? false,
                    })),
                },
            },
            select: {
                id: true,
                quizId: true,
                text: true,
                points: true,
                order: true,
                createdAt: true,
                options: {
                    select: { id: true, text: true, isCorrect: true },
                },
            },
        });

        return question;
    },

    /**
     * Met à jour une question (et ses options si fournies).
     */
    async update(questionId, data, quizmasterId) {
        const question = await ensureQuestionOwnership(questionId, quizmasterId);

        if (question.quiz.isActive) {
            throw new ApiError(400, "Impossible de modifier une question d'un quiz actif. Désactivez-le d'abord.");
        }

        // Si les options sont fournies, on les remplace toutes (delete + create)
        const updateData = {};
        if (data.text !== undefined) updateData.text = data.text;
        if (data.points !== undefined) updateData.points = data.points;
        if (data.order !== undefined) updateData.order = data.order;

        if (data.options) {
            // Transaction : supprimer les anciennes options et créer les nouvelles
            const updated = await prisma.$transaction(async (tx) => {
                await tx.option.deleteMany({ where: { questionId } });

                return tx.question.update({
                    where: { id: questionId },
                    data: {
                        ...updateData,
                        options: {
                            create: data.options.map((opt) => ({
                                text: opt.text,
                                isCorrect: opt.isCorrect ?? false,
                            })),
                        },
                    },
                    select: {
                        id: true,
                        quizId: true,
                        text: true,
                        points: true,
                        order: true,
                        createdAt: true,
                        options: {
                            select: { id: true, text: true, isCorrect: true },
                        },
                    },
                });
            });
            return updated;
        }

        // Mise à jour sans options
        const updated = await prisma.question.update({
            where: { id: questionId },
            data: updateData,
            select: {
                id: true,
                quizId: true,
                text: true,
                points: true,
                order: true,
                createdAt: true,
                options: {
                    select: { id: true, text: true, isCorrect: true },
                },
            },
        });

        return updated;
    },

    /**
     * Supprime une question (cascade : options).
     */
    async delete(questionId, quizmasterId) {
        const question = await ensureQuestionOwnership(questionId, quizmasterId);

        if (question.quiz.isActive) {
            throw new ApiError(400, "Impossible de supprimer une question d'un quiz actif. Désactivez-le d'abord.");
        }

        await prisma.question.delete({ where: { id: questionId } });

        return { id: questionId };
    },
};

module.exports = QuestionService;
