const AuthService = require("../services/auth.service");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

function normalizeRegisterRole(role) {
  if (role === undefined || role === null || role === "") return "participant";
  return String(role).trim().toLowerCase();
}

async function register(req, res, next) {
  const body = typeof req.body === "object" && req.body ? req.body : {};
  const { email, password, name, brandId: rawBrandId } = body;
  if (!email || !password || !name) {
    return next(new ApiError(400, "email, password, name requis"));
  }

  const role = normalizeRegisterRole(body.role);

  /** @type {undefined | number} */
  let brandId;
  if (rawBrandId !== undefined && rawBrandId !== null && rawBrandId !== "") {
    const n = typeof rawBrandId === "number" ? rawBrandId : parseInt(String(rawBrandId), 10);
    if (!Number.isInteger(n) || n < 1) return next(new ApiError(400, "brandId invalide"));
    brandId = n;
  }

  const data = await AuthService.register({
    email: String(email),
    password: String(password),
    name: String(name),
    role,
    brandId,
  });
  res.status(201).json({ status: "success", data });
}

const signupBrands = asyncHandler(async (_req, res) => {
  const data = await AuthService.listBrandsForSignup();
  res.json({ status: "success", data });
});

const session = asyncHandler(async (req, res) => {
  const data = await AuthService.getAuthSessionSnapshot(req.user.id);
  res.json({ status: "success", data });
});

async function login(req, res, next) {
  const { email, password } = req.body;
  if (!email || !password) return next(new ApiError(400, "email et password requis"));
  const data = await AuthService.login({ email: String(email), password: String(password) });
  res.json({ status: "success", data });
}

function logout(_req, res) {
  res.json({ status: "success", message: "Déconnecté (client doit supprimer le token)" });
}

module.exports = {
  register: asyncHandler(register),
  signupBrands,
  session,
  login: asyncHandler(login),
  logout,
};
