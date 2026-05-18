const ApiError = require("../utils/ApiError");

function errorMiddleware(err, _req, res, _next) {
  const status = err instanceof ApiError ? err.statusCode : 500;
  const message = err instanceof ApiError ? err.message : "Erreur serveur";
  if (status === 500) console.error(err);
  res.status(status).json({ status: "error", message });
}

module.exports = errorMiddleware;
