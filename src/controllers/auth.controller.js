/**
 * auth.controller.js — HTTP layer for authentication.
 *
 * Each handler is wrapped in `asyncHandler` and delegates the work to
 * `AuthService`. Responses go through the `responder` envelope so the API
 * shape stays consistent across the codebase.
 */

const AuthService = require('../services/auth.service');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/responder');

const AuthController = {
  /** POST /api/v1/auth/register */
  register: asyncHandler(async (req, res) => {
    const user = await AuthService.register(req.body);
    return created(res, { user }, 'Compte créé avec succès');
  }),

  /** POST /api/v1/auth/login */
  login: asyncHandler(async (req, res) => {
    const { token, user } = await AuthService.login(req.body);
    return ok(res, { token, user }, 'Connexion réussie');
  }),

  /** POST /api/v1/auth/logout */
  logout: asyncHandler(async (req, res) => {
    const result = await AuthService.logout(req.user.id);
    return ok(res, null, result.message);
  }),

  /** GET /api/v1/auth/me */
  me: asyncHandler(async (req, res) => {
    const user = await AuthService.me(req.user.id);
    return ok(res, { user });
  }),

  /** GET /api/v1/auth/brands */
  brands: asyncHandler(async (_req, res) => {
    const brands = await AuthService.listPublicBrands();
    return ok(res, { brands });
  }),
};

module.exports = AuthController;
