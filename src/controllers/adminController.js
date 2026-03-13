const AdminService = require("../services/adminService");
const { userIdParamSchema, getUsersQuerySchema } = require("../validations/adminValidation");
const ApiError = require("../utils/ApiError");

function parseUserId(params) {
    const result = userIdParamSchema.safeParse(params);
    if (!result.success) {
        const fieldErrors = result.error.flatten().fieldErrors;
        throw new ApiError(400, fieldErrors.id?.[0] || "ID utilisateur invalide");
    }
    return result.data.id;
}

function ensureAdminId(req) {
    if (!req.user?.id) {
        throw new ApiError(401, "Admin ID manquant dans le token JWT");
    }
    return req.user.id;
}

/**
 * AdminController — Couche contrôleur pour la gestion des utilisateurs par l'admin.
 * Gère req/res, délègue la logique métier à AdminService.
 */
const AdminController = {
    /**
     * GET /api/admin/users
     * Liste tous les utilisateurs avec filtrage par rôle et pagination.
     * Query params: ?role=participant&page=1&limit=10
     */
    async getAllUsers(req, res, next) {
        try {
            const result = getUsersQuerySchema.safeParse(req.query);
            if (!result.success) {
                const fieldErrors = result.error.flatten().fieldErrors;
                const messages = Object.entries(fieldErrors)
                    .map(([field, errors]) => `${field}: ${errors[0]}`)
                    .join("; ");
                return next(new ApiError(400, messages || "Paramètres invalides"));
            }

            const { role, page, limit } = result.data;
            const data = await AdminService.getAllUsers({ role, page, limit });

            res.status(200).json({
                status: "success",
                message: `${data.total} utilisateur(s) trouvé(s)`,
                data,
            });
        } catch (err) {
            next(err);
        }
    },

    /**
     * PATCH /api/admin/users/:id/block
     * Bloque un utilisateur.
     * Répond avec 200 et l'utilisateur bloqué.
     */
    async blockUser(req, res, next) {
        try {
            const targetId = parseUserId(req.params);
            const adminId = ensureAdminId(req);

            const user = await AdminService.blockUser(targetId, adminId);
            res.status(200).json({
                status: "success",
                message: `Utilisateur ${user.email} bloqué avec succès`,
                data: { user },
            });
        } catch (err) {
            next(err);
        }
    },

    /**
     * PATCH /api/admin/users/:id/unblock
     * Débloque un utilisateur.
     * Répond avec 200 et l'utilisateur débloqué.
     */
    async unblockUser(req, res, next) {
        try {
            const targetId = parseUserId(req.params);
            const adminId = ensureAdminId(req);

            const user = await AdminService.unblockUser(targetId, adminId);
            res.status(200).json({
                status: "success",
                message: `Utilisateur ${user.email} débloqué avec succès`,
                data: { user },
            });
        } catch (err) {
            next(err);
        }
    },

    /**
     * DELETE /api/admin/users/:id
     * Supprime définitivement un utilisateur.
     * Répond avec 200 et un message de confirmation.
     */
    async deleteUser(req, res, next) {
        try {
            const targetId = parseUserId(req.params);
            const adminId = ensureAdminId(req);

            const deleted = await AdminService.deleteUser(targetId, adminId);
            res.status(200).json({
                status: "success",
                message: `Utilisateur ${deleted.email} (${deleted.role}) supprimé définitivement`,
                data: { deleted },
            });
        } catch (err) {
            next(err);
        }
    },

    /**
     * GET /api/admin/users/export/csv
     * Exporte tous les utilisateurs en fichier CSV téléchargeable.
     * Répond avec le fichier CSV avec Content-Type: text/csv.
     */
    async exportUsersCsv(req, res, next) {
        try {
            const csv = await AdminService.exportUsersCsv();
            
            if (!csv || csv.trim().length === 0) {
                return next(new ApiError(400, "Impossible de générer le fichier CSV"));
            }

            const filename = `users_export_${new Date().toISOString().slice(0, 10)}.csv`;

            res.setHeader("Content-Type", "text/csv; charset=utf-8");
            res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
            res.setHeader("Content-Length", Buffer.byteLength(csv, "utf8"));
            res.status(200).send(csv);
        } catch (err) {
            next(err);
        }
    },
};

module.exports = AdminController;
