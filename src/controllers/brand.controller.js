const BrandService = require("../services/brand.service");
const { brandIdParamSchema, getBrandsQuerySchema } = require("../validations/brand.validation");
const ApiError = require("../utils/ApiError");

/**
 * Parse et valide l'ID du paramètre d'URL.
 */
function parseBrandId(params) {
    const result = brandIdParamSchema.safeParse(params);
    if (!result.success) {
        const fieldErrors = result.error.flatten().fieldErrors;
        throw new ApiError(400, fieldErrors.id?.[0] || "ID brand invalide");
    }
    return result.data.id;
}

/**
 * BrandController — Couche contrôleur pour la gestion des brands par l'admin.
 */
const BrandController = {
    /**
     * POST /api/v1/admin/brands
     * Crée un nouveau brand.
     */
    async create(req, res, next) {
        try {
            const brand = await BrandService.create(req.body);
            res.status(201).json({
                status: "success",
                message: "Brand créé avec succès",
                data: { brand },
            });
        } catch (err) {
            next(err);
        }
    },

    /**
     * GET /api/v1/admin/brands
     * Liste tous les brands avec pagination.
     */
    async getAll(req, res, next) {
        try {
            const result = getBrandsQuerySchema.safeParse(req.query);
            if (!result.success) {
                const fieldErrors = result.error.flatten().fieldErrors;
                const messages = Object.entries(fieldErrors)
                    .map(([field, errors]) => `${field}: ${errors[0]}`)
                    .join("; ");
                return next(new ApiError(400, messages || "Paramètres invalides"));
            }

            const { page, limit } = result.data;
            const data = await BrandService.getAll({ page, limit });

            res.status(200).json({
                status: "success",
                message: `${data.total} brand(s) trouvé(s)`,
                data,
            });
        } catch (err) {
            next(err);
        }
    },

    /**
     * GET /api/v1/admin/brands/:id
     * Récupère un brand par son ID (avec ses quizmasters).
     */
    async getById(req, res, next) {
        try {
            const id = parseBrandId(req.params);
            const brand = await BrandService.getById(id);

            res.status(200).json({
                status: "success",
                data: { brand },
            });
        } catch (err) {
            next(err);
        }
    },

    /**
     * PUT /api/v1/admin/brands/:id
     * Met à jour un brand existant.
     */
    async update(req, res, next) {
        try {
            const id = parseBrandId(req.params);
            const brand = await BrandService.update(id, req.body);

            res.status(200).json({
                status: "success",
                message: "Brand mis à jour avec succès",
                data: { brand },
            });
        } catch (err) {
            next(err);
        }
    },

    /**
     * DELETE /api/v1/admin/brands/:id
     * Supprime un brand (échoue si des quizmasters sont liés).
     */
    async delete(req, res, next) {
        try {
            const id = parseBrandId(req.params);
            const deleted = await BrandService.delete(id);

            res.status(200).json({
                status: "success",
                message: `Brand ${deleted.email} supprimé avec succès`,
                data: { id: deleted.id },
            });
        } catch (err) {
            next(err);
        }
    },
};

module.exports = BrandController;
