const ApiError = require("../utils/ApiError");
const { publicUrlFor } = require("../middlewares/upload");

/**
 * UploadController — Returns the public URL of an uploaded file.
 *
 * The actual multer middleware is set per-route to control the destination folder
 * (e.g. /avatars, /products, /quizzes, /coupons).
 */
const UploadController = {
    async uploadOne(req, res, next) {
        try {
            if (!req.file) return next(new ApiError(400, "Fichier manquant"));
            const url = publicUrlFor(req.file);
            res.status(201).json({
                status: "success",
                message: "Fichier téléversé avec succès",
                data: {
                    url,
                    filename: req.file.filename,
                    mimetype: req.file.mimetype,
                    size: req.file.size,
                },
            });
        } catch (err) {
            next(err);
        }
    },
};

module.exports = UploadController;
