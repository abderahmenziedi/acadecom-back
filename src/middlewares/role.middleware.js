const ApiError = require("../utils/ApiError");

function permit(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new ApiError(401, "Non authentifié"));
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, "Accès refusé"));
    }
    next();
  };
}

module.exports = permit;
