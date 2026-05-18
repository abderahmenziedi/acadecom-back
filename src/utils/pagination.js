/**
 * pagination.js — pagination helpers shared by every paginated endpoint.
 *
 * Use `parsePagination(query)` to normalise `?page=&limit=` from req.query
 * (always coerce + clamp + apply sane defaults), and `paginatedPayload(...)`
 * to build the standard response envelope:
 *
 *   { items, total, page, limit, totalPages }
 *
 * Keeping a single shape avoids the historical drift between
 * `{ users, total, page }`, `{ quizzes, total }`, `{ products, total }` etc.
 */

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * @param {object} query Express `req.query` (or any plain object).
 * @returns {{ page: number, limit: number, skip: number }}
 */
function parsePagination(query = {}) {
  const rawPage = Number.parseInt(query.page, 10);
  const rawLimit = Number.parseInt(query.limit, 10);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : DEFAULT_PAGE;
  const limit = Math.min(
    MAX_LIMIT,
    Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : DEFAULT_LIMIT,
  );

  return { page, limit, skip: (page - 1) * limit };
}

/**
 * Build the canonical paginated payload.
 *
 * @template T
 * @param {{ items: T[], total: number, page: number, limit: number, extra?: object }} args
 */
function paginatedPayload({ items, total, page, limit, extra = {} }) {
  return {
    items,
    total,
    page,
    limit,
    totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
    ...extra,
  };
}

module.exports = { parsePagination, paginatedPayload, MAX_LIMIT };
