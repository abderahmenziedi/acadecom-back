/**
 * upload.js — Multer-based file upload middleware (images only).
 *
 * Stores uploaded files on disk under `uploads/<category>/<random>.<ext>` and
 * exposes the public URL `/uploads/...`. Sized at 4 MB per file.
 */
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const ApiError = require("../utils/ApiError");

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
ensureDir(UPLOAD_ROOT);

const ALLOWED_MIME = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/svg+xml",
]);

function makeFilename(original) {
    const ext = path.extname(original || "").toLowerCase() || ".png";
    const rand = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    return `${rand}${ext}`;
}

function storageFor(category) {
    return multer.diskStorage({
        destination(req, _file, cb) {
            const dir = path.join(UPLOAD_ROOT, sanitizeCategory(category));
            ensureDir(dir);
            cb(null, dir);
        },
        filename(_req, file, cb) {
            cb(null, makeFilename(file.originalname));
        },
    });
}

function sanitizeCategory(c) {
    if (!c) return "misc";
    return String(c).replace(/[^a-z0-9_-]/gi, "").slice(0, 32) || "misc";
}

function fileFilter(_req, file, cb) {
    if (!ALLOWED_MIME.has(file.mimetype)) {
        return cb(new ApiError(400, `Format d'image non supporté (${file.mimetype})`));
    }
    cb(null, true);
}

function imageUploader(category = "misc", maxFiles = 1) {
    const upload = multer({
        storage: storageFor(category),
        fileFilter,
        limits: { fileSize: 4 * 1024 * 1024 }, // 4 MB
    });
    return maxFiles === 1 ? upload.single("file") : upload.array("file", maxFiles);
}

/**
 * Build the public URL for an uploaded file relative to UPLOAD_ROOT.
 */
function publicUrlFor(file) {
    if (!file) return null;
    const rel = path.relative(UPLOAD_ROOT, file.path).replace(/\\/g, "/");
    return `/uploads/${rel}`;
}

/**
 * Delete a previously uploaded file given its public URL. Safe (best effort).
 */
function deleteByPublicUrl(url) {
    if (!url || typeof url !== "string" || !url.startsWith("/uploads/")) return;
    try {
        const rel = url.replace(/^\/uploads\//, "");
        const safe = rel.split(/[\\/]+/).filter(p => p && p !== "..").join(path.sep);
        const abs = path.join(UPLOAD_ROOT, safe);
        if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
            fs.unlinkSync(abs);
        }
    } catch (_) { /* ignore */ }
}

module.exports = {
    UPLOAD_ROOT,
    imageUploader,
    publicUrlFor,
    deleteByPublicUrl,
};
