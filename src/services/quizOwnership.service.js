const prisma = require("../config/prisma");

/**
 * Transfère l’ownership « créateur » des quiz vers la marque uniquement :
 * conserve brandId, statistiques, tentatives ; détache le quizmaster supprimé.
 *
 * @param {number} quizmasterId
 * @returns {Promise<{ count: number }>}
 */
async function detachQuizmasterFromAllQuizzes(quizmasterId) {
    return prisma.quiz.updateMany({
        where: { quizmasterId },
        data: { quizmasterId: null },
    });
}

module.exports = {
    detachQuizmasterFromAllQuizzes,
};
