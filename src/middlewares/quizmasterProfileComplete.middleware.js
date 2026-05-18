const prisma = require("../prisma/client");
const ApiError = require("../utils/ApiError");

async function requireQuizmasterProfileComplete(req, _res, next) {
  try {
    const qm = await prisma.quizmaster.findUnique({
      where: { userId: req.user.id },
      select: { isProfileComplete: true },
    });
    if (!qm) return next(new ApiError(403, "Compte quizmaster introuvable"));
    if (!qm.isProfileComplete) {
      return next(
        new ApiError(
          403,
          "Profil incomplet : complétez votre profil (photo, téléphone avec indicatif, genre, date de naissance, nom et email) pour gérer les quiz.",
        ),
      );
    }
    return next();
  } catch (e) {
    return next(e);
  }
}

module.exports = requireQuizmasterProfileComplete;
