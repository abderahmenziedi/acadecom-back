const ApiError = require("../utils/ApiError");

/**
 * Middleware de contrôle d'accès basé sur les rôles (RBAC).
 * À utiliser APRÈS le middleware `auth`.
 * @param {...string} allowedRoles - Les rôles autorisés (ex: "ADMIN", "BRAND")
 */
function permit(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, "Non authentifié"));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new ApiError(403, `Accès refusé : rôle '${req.user.role}' non autorisé`));
    }
    next();
  };
}

module.exports = permit;