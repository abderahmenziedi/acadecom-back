const ApiError = require("./ApiError");

function requirePositiveIntParam(raw, label = "Identifiant") {
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isInteger(n) || n < 1) throw new ApiError(400, `${label} invalide`);
  return n;
}

module.exports = { requirePositiveIntParam };
