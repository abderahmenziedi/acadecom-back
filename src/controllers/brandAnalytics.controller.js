const BrandAnalyticsService = require("../services/brandAnalytics.service");
const { brandIdParamSchema } = require("../validations/brand.validation");
const ApiError = require("../utils/ApiError");

function parseBrandId(params) {
    const result = brandIdParamSchema.safeParse(params);
    if (!result.success) {
        const fieldErrors = result.error.flatten().fieldErrors;
        throw new ApiError(400, fieldErrors.id?.[0] || "ID brand invalide");
    }
    return result.data.id;
}

/**
 * BrandAnalyticsController — Analytics et dashboard pour les brands.
 */
const BrandAnalyticsController = {
    /**
     * GET /api/v1/brand/:id/analytics
     * Analytics d'un brand spécifique (admin ou brand lui-même).
     */
    async getBrandAnalytics(req, res, next) {
        try {
            const brandId = parseBrandId(req.params);

            // Si le user est un brand, il ne peut voir que ses propres analytics
            if (req.user.role === "brand" && req.user.id !== brandId) {
                return next(new ApiError(403, "Vous ne pouvez accéder qu'à vos propres analytics"));
            }

            const analytics = await BrandAnalyticsService.getBrandAnalytics(brandId);

            res.status(200).json({
                status: "success",
                data: { analytics },
            });
        } catch (err) {
            next(err);
        }
    },

    /**
     * GET /api/v1/brand/dashboard
     * Dashboard global du brand connecté.
     */
    async getDashboard(req, res, next) {
        try {
            if (req.user.role !== "brand") {
                return next(new ApiError(403, "Seuls les brands peuvent accéder à leur dashboard"));
            }

            const dashboard = await BrandAnalyticsService.getDashboard(req.user.id);

            res.status(200).json({
                status: "success",
                data: { dashboard },
            });
        } catch (err) {
            next(err);
        }
    },
};

module.exports = BrandAnalyticsController;
