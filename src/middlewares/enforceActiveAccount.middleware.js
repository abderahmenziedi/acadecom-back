const prisma = require("../prisma/client");
const ApiError = require("../utils/ApiError");

const BLOCKED_MESSAGE = "Account is blocked. Access denied to all features.";

/** Refuse tout accès métier si le compte est suspendu (soft mode : login autorisé, API protégées non). */
async function enforceActiveAccount(req, _res, next) {
  try {
    if (!req.user?.id) return next();
    const u = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { isBlocked: true },
    });
    if (u?.isBlocked) return next(new ApiError(403, BLOCKED_MESSAGE));
    next();
  } catch (e) {
    next(e);
  }
}

module.exports = enforceActiveAccount;
module.exports.BLOCKED_MESSAGE = BLOCKED_MESSAGE;
