/**
 * admin.controller.js — HTTP layer for admin user management.
 *
 * All validation runs in the route via `validate({ ... })`; this layer only
 * destructures parsed input and delegates to the service.
 */

const AdminService = require('../services/admin.service');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/responder');

const AdminController = {
  /** GET /api/v1/admin/users */
  listUsers: asyncHandler(async (req, res) => {
    const { role, page, limit, search, isBlocked } = req.validatedQuery;
    const data = await AdminService.listUsers({ role, page, limit, search, isBlocked });
    return ok(res, data, `${data.total} utilisateur(s) trouvé(s)`);
  }),

  /** PATCH /api/v1/admin/users/:id/block */
  blockUser: asyncHandler(async (req, res) => {
    const user = await AdminService.blockUser(req.params.id, req.user.id);
    return ok(res, { user }, `Utilisateur ${user.email} bloqué avec succès`);
  }),

  /** PATCH /api/v1/admin/users/:id/unblock */
  unblockUser: asyncHandler(async (req, res) => {
    const user = await AdminService.unblockUser(req.params.id, req.user.id);
    return ok(res, { user }, `Utilisateur ${user.email} débloqué avec succès`);
  }),

  /** DELETE /api/v1/admin/users/:id */
  deleteUser: asyncHandler(async (req, res) => {
    const deleted = await AdminService.deleteUser(req.params.id, req.user.id);
    return ok(res, { deleted }, `Utilisateur ${deleted.email} supprimé`);
  }),

  /** GET /api/v1/admin/users/export/csv */
  exportUsersCsv: asyncHandler(async (_req, res) => {
    const csv = await AdminService.exportUsersCsv();
    const filename = `users_export_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', Buffer.byteLength(csv, 'utf8'));
    return res.status(200).send(csv);
  }),
};

module.exports = AdminController;
