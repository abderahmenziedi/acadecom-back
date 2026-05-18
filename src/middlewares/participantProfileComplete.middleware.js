const prisma = require("../prisma/client");
const ApiError = require("../utils/ApiError");

/** Bloque jouer au quiz tant que `isProfileComplete` est faux. */
async function requireParticipantProfileComplete(req, _res, next) {
  try {
    const p = await prisma.participant.findUnique({
      where: { userId: req.user.id },
      select: { isProfileComplete: true },
    });
    if (!p) return next(new ApiError(403, "Compte participant introuvable"));
    if (!p.isProfileComplete) {
      return next(
        new ApiError(
          403,
          "Profil incomplet : complétez votre profil (nom, photo, téléphone avec indicatif, genre, naissance, pays, ville et email valide) pour jouer.",
        ),
      );
    }
    return next();
  } catch (e) {
    return next(e);
  }
}

module.exports = requireParticipantProfileComplete;
