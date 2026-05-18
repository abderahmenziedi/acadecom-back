/**
 * rateLimiter.js — request-rate limiting middlewares.
 *
 * Two limiters are exposed:
 *
 *  - `authLimiter`  — protects /auth/login and /auth/register against
 *                     brute-force credential stuffing. Defaults to
 *                     5 requests / 15 minutes / IP, configurable via env.
 *
 *  - `apiLimiter`   — global soft cap to keep noisy or buggy clients from
 *                     bringing down the server (300 req / minute / IP).
 *
 * Both honour the standard `RateLimit-*` response headers and return a
 * 429 JSON body matching the application envelope.
 */

const rateLimit = require('express-rate-limit');
const ApiError = require('../utils/ApiError');

const windowMsAuth = Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000;
const maxAuth = Number.parseInt(process.env.RATE_LIMIT_MAX, 10) || 5;

const authLimiter = rateLimit({
  windowMs: windowMsAuth,
  max: maxAuth,
  standardHeaders: true,
  legacyHeaders: false,
  // Skip in test runs — we don't want the limiter to bleed across tests.
  skip: () => process.env.NODE_ENV === 'test',
  handler: (req, _res, next) => {
    next(
      ApiError.tooMany(
        `Trop de tentatives. Réessayez dans ${Math.ceil(windowMsAuth / 60_000)} minutes.`,
        { code: 'RATE_LIMITED' },
      ),
    );
  },
});

const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  handler: (req, _res, next) => {
    next(ApiError.tooMany('Trop de requêtes — ralentissez.', { code: 'RATE_LIMITED' }));
  },
});

module.exports = { authLimiter, apiLimiter };
