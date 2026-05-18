/**
 * routes/index.js — central API route registry.
 *
 * Refactored modules (Phase 2a): auth, admin (users), participant.
 * Legacy modules retain their existing structure but already benefit from
 * the new error middleware, validate v2, and security hardening through
 * the shared middlewares.
 */

const authRoutes = require('./auth.routes');
const adminRoutes = require('./admin.routes');
const brandRoutes = require('./brand.routes');
const quizmasterRoutes = require('./quizmaster.routes');
const brandSelfRoutes = require('./brandSelf.routes');
const quizRoutes = require('./quiz.routes');
const questionRoutes = require('./question.routes');
const analyticsRoutes = require('./analytics.routes');
const participantRoutes = require('./participant.routes');
const leaderboardRoutes = require('./leaderboard.routes');
const storeRoutes = require('./store.routes');
const notificationRoutes = require('./notification.routes');
const profileRoutes = require('./profile.routes');
const uploadRoutes = require('./upload.routes');
const activityRoutes = require('./activity.routes');

const API_PREFIX = '/api/v1';

const ROUTE_REGISTRY = [
  ['/auth', authRoutes],
  ['/admin', adminRoutes],
  ['/admin/brands', brandRoutes],
  ['/admin/quizmasters', quizmasterRoutes],
  ['/brand', brandSelfRoutes],
  ['/quizmaster/quizzes', quizRoutes],
  ['/quizmaster/questions', questionRoutes],
  ['/quizmaster/dashboard', analyticsRoutes],
  ['/participant', participantRoutes],
  ['/leaderboard', leaderboardRoutes],
  ['/store', storeRoutes],
  ['/notifications', notificationRoutes],
  ['/profile', profileRoutes],
  ['/uploads', uploadRoutes],
  ['/activity', activityRoutes],
];

/**
 * Register every API route on the given Express app under `/api/v1`.
 *
 * @param {import('express').Express} app
 */
function registerApiRoutes(app) {
  for (const [path, router] of ROUTE_REGISTRY) {
    app.use(`${API_PREFIX}${path}`, router);
  }
}

module.exports = { registerApiRoutes, API_PREFIX, ROUTE_REGISTRY };
