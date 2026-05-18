const prisma = require("../prisma/client");
const ApiError = require("../utils/ApiError");

/** Bloque tout accès réservé aux quizmasters tant que validation brand ≠ ACTIVE */
async function requireQuizmasterApproved(req, _res, next) {
  try {
    if (req.user?.role !== "quizmaster") return next();
    const qm = await prisma.quizmaster.findUnique({
      where: { userId: req.user.id },
      select: { approvalStatus: true },
    });
    if (!qm) return next(new ApiError(403, "Compte quizmaster introuvable"));
    if (qm.approvalStatus !== "ACTIVE") {
      return next(new ApiError(403, "Quizmaster non validé par la marque"));
    }
    next();
  } catch (e) {
    next(e);
  }
}

module.exports = requireQuizmasterApproved;
