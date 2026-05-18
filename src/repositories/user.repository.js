/**
 * user.repository.js — thin data-access layer for the `User` model.
 *
 * The repository's job is to encapsulate Prisma calls so services can
 * stay focused on business rules. No throwing of `ApiError` happens
 * here — that responsibility belongs to the service layer (we return
 * `null` or empty collections when something is missing).
 */

const prisma = require('../config/prisma');

/** Common projection that omits the password and other internals. */
const PUBLIC_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isBlocked: true,
  brandId: true,
  avatar: true,
  xp: true,
  coupons: true,
  createdAt: true,
  updatedAt: true,
};

/** Projection used by admin listings. */
const ADMIN_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isBlocked: true,
  brandId: true,
  createdAt: true,
};

const UserRepository = {
  PUBLIC_SELECT,
  ADMIN_SELECT,

  /** Lookup by id with the safe public projection. */
  findById(id) {
    return prisma.user.findUnique({ where: { id }, select: PUBLIC_SELECT });
  },

  /** Lookup by id, but with the password column — for credential checks only. */
  findByIdWithPassword(id) {
    return prisma.user.findUnique({
      where: { id },
      select: { ...PUBLIC_SELECT, password: true },
    });
  },

  /** Lookup by email (full row, includes password — use sparingly). */
  findByEmailWithPassword(email) {
    return prisma.user.findUnique({ where: { email } });
  },

  /** Light existence check. */
  emailExists(email) {
    return prisma.user
      .findUnique({ where: { email }, select: { id: true } })
      .then((u) => Boolean(u));
  },

  /**
   * Create a user.
   * @param {object} data
   * @param {object} [options]
   * @param {object} [options.select=PUBLIC_SELECT]
   * @param {object} [options.include]
   */
  create(data, { select = PUBLIC_SELECT, include } = {}) {
    return prisma.user.create({
      data,
      ...(include ? { include } : { select }),
    });
  },

  /**
   * Update a user.
   * @param {number} id
   * @param {object} data
   * @param {object} [options]
   * @param {object} [options.select=PUBLIC_SELECT]
   */
  update(id, data, { select = PUBLIC_SELECT } = {}) {
    return prisma.user.update({ where: { id }, data, select });
  },

  /**
   * Paginate users with optional role / blocked / search filters.
   *
   * @param {object} args
   * @param {number} args.skip
   * @param {number} args.take
   * @param {string} [args.role]
   * @param {boolean}[args.isBlocked]
   * @param {string} [args.search]   Case-insensitive match on name / email.
   */
  async paginate({ skip, take, role, isBlocked, search }) {
    const where = {};
    if (role) where.role = role;
    if (typeof isBlocked === 'boolean') where.isBlocked = isBlocked;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const [items, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: ADMIN_SELECT,
      }),
      prisma.user.count({ where }),
    ]);

    return { items, total };
  },

  /** Active brands available for public quizmaster sign-up. */
  listActiveBrands() {
    return prisma.user.findMany({
      where: { role: 'brand', isBlocked: false, brandDeletedAt: null },
      select: { id: true, name: true, industry: true },
      orderBy: { name: 'asc' },
    });
  },

  /** Hard-delete (used by admin for participant or quizmaster cleanup). */
  delete(id, { select = ADMIN_SELECT } = {}) {
    return prisma.user.delete({ where: { id }, select });
  },

  /**
   * Brand-status snapshot used by the auth middleware (does not return
   * the password). Kept here so all User queries live in one place.
   */
  loadStatusSnapshot(id) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        isBlocked: true,
        deactivatedReason: true,
        brandId: true,
        brandDeletedAt: true,
        brand: { select: { id: true, isBlocked: true, brandDeletedAt: true } },
      },
    });
  },
};

module.exports = UserRepository;
