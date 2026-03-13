const jwt = require("jsonwebtoken");
const ApiError = require("../utils/ApiError");

/**
 * Middleware d'authentification JWT.
 * Vérifie le header "Authorization: Bearer <token>".
 * En cas de succès, attache req.user = { id, role }.
 */
function auth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new ApiError(401, "Accès refusé : token manquant"));
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return next(new ApiError(401, "Accès refusé : token manquant"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role, iat, exp }
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return next(new ApiError(401, "Session expirée, veuillez vous reconnecter"));
    }
    return next(new ApiError(403, "Token invalide"));
  }
}

module.exports = auth;