const QuizmasterService = require("../services/quizmaster.service");
const { quizmasterIdParamSchema, getQuizmastersQuerySchema } = require("../validations/quizmaster.validation");
const ApiError = require("../utils/ApiError");

/**
 * Parse et valide l'ID du paramètre d'URL.
 */
function parseQuizmasterId(params) {
    const result = quizmasterIdParamSchema.safeParse(params);
    if (!result.success) {
        const fieldErrors = result.error.flatten().fieldErrors;
        throw new ApiError(400, fieldErrors.id?.[0] || "ID quizmaster invalide");
    }
    return result.data.id;
}

/**
 * QuizmasterController — Couche contrôleur pour la gestion des quizmasters par l'admin.
 */
const QuizmasterController = {
    /**
     * POST /api/v1/admin/quizmasters
     * Crée un nouveau quizmaster (lié à un brand).
     */
    async create(req, res, next) {
        try {
            const quizmaster = await QuizmasterService.create(req.body);
            res.status(201).json({
                status: "success",
                message: "Quizmaster créé avec succès",
                data: { quizmaster },
            });
        } catch (err) {
            next(err);
        }
    },

    /**
     * GET /api/v1/admin/quizmasters
     * Liste tous les quizmasters avec pagination et filtre optionnel par brandId.
     */
    async getAll(req, res, next) {
        try {
            const result = getQuizmastersQuerySchema.safeParse(req.query);
            if (!result.success) {
                const fieldErrors = result.error.flatten().fieldErrors;
                const messages = Object.entries(fieldErrors)
                    .map(([field, errors]) => `${field}: ${errors[0]}`)
                    .join("; ");
                return next(new ApiError(400, messages || "Paramètres invalides"));
            }

            const { brandId, page, limit } = result.data;
            const data = await QuizmasterService.getAll({ brandId, page, limit });

            res.status(200).json({
                status: "success",
                message: `${data.total} quizmaster(s) trouvé(s)`,
                data,
            });
        } catch (err) {
            next(err);
        }
    },

    /**
     * GET /api/v1/admin/quizmasters/:id
     * Récupère un quizmaster par son ID.
     */
    async getById(req, res, next) {
        try {
            const id = parseQuizmasterId(req.params);
            const quizmaster = await QuizmasterService.getById(id);

            res.status(200).json({
                status: "success",
                data: { quizmaster },
            });
        } catch (err) {
            next(err);
        }
    },

    /**
     * PUT /api/v1/admin/quizmasters/:id
     * Met à jour un quizmaster existant.
     */
    async update(req, res, next) {
        try {
            const id = parseQuizmasterId(req.params);
            const quizmaster = await QuizmasterService.update(id, req.body);

            res.status(200).json({
                status: "success",
                message: "Quizmaster mis à jour avec succès",
                data: { quizmaster },
            });
        } catch (err) {
            next(err);
        }
    },

    /**
     * DELETE /api/v1/admin/quizmasters/:id
     * Supprime un quizmaster.
     */
    async delete(req, res, next) {
        try {
            const id = parseQuizmasterId(req.params);
            const deleted = await QuizmasterService.delete(id);

            res.status(200).json({
                status: "success",
                message: `Quizmaster ${deleted.email} supprimé avec succès`,
                data: { id: deleted.id },
            });
        } catch (err) {
            next(err);
        }
    },
};

module.exports = QuizmasterController;
