const prisma = require("../config/prisma");
const bcrypt = require("bcrypt");
const ApiError = require("../utils/ApiError");
const { deleteByPublicUrl } = require("../middlewares/upload");

/**
 * Common profile fields exposed for /me endpoints.
 * Password is never returned.
 */
const profileSelect = {
    id: true,
    name: true,
    email: true,
    role: true,
    avatar: true,
    phone: true,
    bio: true,
    address: true,
    website: true,
    socialLinks: true,
    industry: true,
    description: true,
    brandId: true,
    isBlocked: true,
    xp: true,
    level: true,
    totalPoints: true,
    coupons: true,
    createdAt: true,
    updatedAt: true,
};

function parseSocialLinks(raw) {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
}

/**
 * ProfileService — Shared "me" endpoints for every authenticated user.
 *
 * - getMe(userId)                — profile for the authenticated user
 * - updateMe(userId, data)        — patch profile fields
 * - changePassword(userId, ...)   — secure password change with current verification
 * - changeAvatar(userId, url)     — set avatar URL (after upload)
 * - deleteAvatar(userId)          — remove avatar file from disk + DB
 */
const ProfileService = {
    async getMe(userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: profileSelect,
        });
        if (!user) throw new ApiError(404, "Utilisateur introuvable");
        return { ...user, socialLinks: parseSocialLinks(user.socialLinks) };
    },

    async updateMe(userId, data) {
        const patch = {};
        const allowed = [
            "name", "phone", "bio", "address", "website",
            "industry", "description", "avatar",
        ];
        for (const key of allowed) {
            if (data[key] !== undefined) patch[key] = data[key];
        }
        if (data.socialLinks !== undefined) {
            patch.socialLinks = data.socialLinks
                ? JSON.stringify(data.socialLinks)
                : null;
        }
        if (Object.keys(patch).length === 0) {
            throw new ApiError(400, "Aucune donnée à mettre à jour");
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data: patch,
            select: profileSelect,
        });
        return { ...user, socialLinks: parseSocialLinks(user.socialLinks) };
    },

    async changePassword(userId, currentPassword, newPassword) {
        if (!currentPassword || !newPassword) {
            throw new ApiError(400, "Mot de passe actuel et nouveau requis");
        }
        if (newPassword.length < 6) {
            throw new ApiError(400, "Le nouveau mot de passe doit contenir au moins 6 caractères");
        }
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new ApiError(404, "Utilisateur introuvable");

        const ok = await bcrypt.compare(currentPassword, user.password);
        if (!ok) throw new ApiError(401, "Mot de passe actuel incorrect");

        const hashed = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: userId },
            data: { password: hashed },
        });
        return { ok: true };
    },

    async changeAvatar(userId, url) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { avatar: true },
        });
        if (!user) throw new ApiError(404, "Utilisateur introuvable");

        if (user.avatar && user.avatar !== url) {
            deleteByPublicUrl(user.avatar);
        }
        const updated = await prisma.user.update({
            where: { id: userId },
            data: { avatar: url || null },
            select: profileSelect,
        });
        return { ...updated, socialLinks: parseSocialLinks(updated.socialLinks) };
    },

    async deleteAvatar(userId) {
        return this.changeAvatar(userId, null);
    },
};

module.exports = ProfileService;
