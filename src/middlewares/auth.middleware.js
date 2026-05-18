const jwt = require("jsonwebtoken");
const ApiError = require("../utils/ApiError");

function auth(req, _res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) {
    return next(new ApiError(401, "Token manquant"));
  }
  const token = h.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch (e) {
    if (e.name === "TokenExpiredError") return next(new ApiError(401, "Session expirée"));
    return next(new ApiError(403, "Token invalide"));
  }
}

module.exports = auth;
