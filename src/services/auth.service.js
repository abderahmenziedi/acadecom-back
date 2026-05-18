/**
 * auth.service.js — authentication business rules.
 *
 * Responsibilities:
 *   - Validate role-specific invariants (quizmaster requires an active brand).
 *   - Hash passwords with bcrypt (10 rounds — explicit, matches existing data).
 *   - Sign JWTs with the configured TTL.
 *   - Surface friendly errors via `ApiError`.
 *
 * Anything touching Prisma directly lives in `repositories/user.repository.js`.
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const UserRepository = require('../repositories/user.repository');
const ApiError = require('../utils/ApiError');
const {
  MSG_QUIZMASTER_BRAND_REMOVED,
  MSG_BRAND_ACCOUNT_CLOSED,
  CODE_ACCOUNT_REVOKED,
  CODE_BRAND_REMOVED,
  CODE_INVALID_QUIZMASTER,
} = require('../constants/accounts');

const BCRYPT_ROUNDS = 10;
const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '4h';

/**
 * Strip the password column from a user row (defensive).
 * @param {object} user
 */
function omitPassword(user) {
  if (!user) return user;
  const { password: _pw, ...safe } = user;
  return safe;
}

/**
 * Build the JWT payload for a user (kept minimal — services revalidate role
 * via the auth middleware on every request).
 *
 * @param {{ id: number, role: string, brandId?: number }} user
 */
function buildJwtPayload(user) {
  const payload = { id: user.id, role: user.role };
  if (user.role === 'quizmaster' && user.brandId) payload.brandId = user.brandId;
  return payload;
}

const AuthService = {
  ACCESS_TOKEN_TTL,

  /**
   * Register a new account. Admins cannot be created via this path.
   *
   * @param {object} input
   * @returns {Promise<object>} The created user (without password).
   */
  async register(input) {
    const { name, email, password, role = 'participant', brandId } = input;

    if (await UserRepository.emailExists(email)) {
      // Note: this *does* reveal email existence — acceptable trade-off for
      // user experience on a PFE. A future hardening would route both
      // "already exists" and "created" through the same email-verification
      // flow.
      throw ApiError.conflict('Cet email est déjà enregistré');
    }

    if (role === 'quizmaster') {
      if (!brandId) {
        throw ApiError.badRequest('Un quizmaster doit obligatoirement sélectionner une marque.');
      }
      const brand = await UserRepository.findById(brandId);
      if (!brand || brand.role !== 'brand') {
        throw ApiError.notFound('Marque introuvable');
      }
      if (brand.isBlocked) {
        throw ApiError.badRequest("Cette marque n'accepte plus de nouveaux quizmasters");
      }
    }

    const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const created = await UserRepository.create(
      {
        name,
        email,
        password: hashed,
        role,
        ...(role === 'quizmaster' && brandId ? { brandId } : {}),
      },
      {
        include:
          role === 'quizmaster'
            ? { brand: { select: { id: true, name: true, email: true } } }
            : undefined,
      },
    );

    return omitPassword(created);
  },

  /**
   * Verify credentials and return a JWT + the safe user projection.
   *
   * @param {{ email: string, password: string }} input
   */
  async login({ email, password }) {
    const user = await UserRepository.findByEmailWithPassword(email);

    // Deliberately uniform error to avoid email enumeration.
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw ApiError.unauthorized('Identifiants invalides');
    }

    if (user.role === 'brand' && user.brandDeletedAt) {
      throw ApiError.forbidden(MSG_BRAND_ACCOUNT_CLOSED, { code: CODE_BRAND_REMOVED });
    }
    if (user.isBlocked) {
      throw ApiError.forbidden(
        user.deactivatedReason ||
          'Votre compte a été suspendu. Veuillez contacter un administrateur.',
        { code: CODE_ACCOUNT_REVOKED },
      );
    }

    let brand;
    if (user.role === 'quizmaster') {
      if (!user.brandId) {
        throw ApiError.forbidden(
          'Compte quizmaster invalide : aucune marque associée. Contactez un administrateur.',
          { code: CODE_INVALID_QUIZMASTER },
        );
      }
      const parent = await UserRepository.findById(user.brandId);
      if (!parent || parent.isBlocked) {
        throw ApiError.forbidden(MSG_QUIZMASTER_BRAND_REMOVED, { code: CODE_ACCOUNT_REVOKED });
      }
      brand = { id: parent.id, email: parent.email, name: parent.name };
    }

    const token = jwt.sign(buildJwtPayload(user), process.env.JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_TTL,
    });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        ...(user.role === 'quizmaster' ? { brandId: user.brandId, brand } : {}),
      },
    };
  },

  /**
   * Logout — JWT is stateless, so this is a no-op on the server. Kept for
   * audit-trail extension points (Phase 2b will log this to ActivityLog).
   */
  async logout(/* userId */) {
    return { message: 'Déconnexion réussie' };
  },

  /**
   * The "current user" payload (used by `GET /auth/me`).
   * @param {number} userId
   */
  async me(userId) {
    const user = await UserRepository.findById(userId);
    if (!user) throw ApiError.notFound('Utilisateur introuvable');
    return user;
  },

  /** Public list of brands available for quizmaster registration. */
  async listPublicBrands() {
    return UserRepository.listActiveBrands();
  },
};

module.exports = AuthService;
