const ProfileService = require("../services/profile.service");
const ApiError = require("../utils/ApiError");

const ProfileController = {
    async getMe(req, res, next) {
        try {
            const user = await ProfileService.getMe(req.user.id);
            res.json({ status: "success", data: { user } });
        } catch (err) { next(err); }
    },

    async updateMe(req, res, next) {
        try {
            const user = await ProfileService.updateMe(req.user.id, req.body);
            res.json({
                status: "success",
                message: "Profil mis à jour avec succès",
                data: { user },
            });
        } catch (err) { next(err); }
    },

    async changePassword(req, res, next) {
        try {
            const { currentPassword, newPassword } = req.body;
            await ProfileService.changePassword(req.user.id, currentPassword, newPassword);
            res.json({
                status: "success",
                message: "Mot de passe mis à jour",
            });
        } catch (err) { next(err); }
    },

    async changeAvatar(req, res, next) {
        try {
            const url = req.body?.url;
            if (typeof url !== "string" && url !== null) {
                throw new ApiError(400, "URL de l'avatar invalide");
            }
            const user = await ProfileService.changeAvatar(req.user.id, url);
            res.json({
                status: "success",
                message: "Avatar mis à jour",
                data: { user },
            });
        } catch (err) { next(err); }
    },

    async deleteAvatar(req, res, next) {
        try {
            const user = await ProfileService.deleteAvatar(req.user.id);
            res.json({
                status: "success",
                message: "Avatar supprimé",
                data: { user },
            });
        } catch (err) { next(err); }
    },
};

module.exports = ProfileController;
