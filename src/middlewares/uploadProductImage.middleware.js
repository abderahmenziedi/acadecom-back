const fs = require("fs");
const path = require("path");
const multer = require("multer");

const dest = path.join(__dirname, "..", "..", "uploads", "products");
fs.mkdirSync(dest, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, dest),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const allowed = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
    const safeExt = allowed.includes(ext) ? ext : ".bin";
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 12)}${safeExt}`);
  },
});

function imageFileFilter(_req, file, cb) {
  const ok = /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype);
  if (!ok) return cb(new Error("Format d’image non autorisé (JPEG, PNG, GIF, WebP)."));
  cb(null, true);
}

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

/** Champ fichier optionnel `image` ; erreur Multer renvoyée en 400 via handler Express si besoin */
function uploadProductImageOptional(req, res, next) {
  upload.single("image")(req, res, (err) => {
    if (!err) return next();
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Image trop volumineuse (max 2&nbsp;Mo)."
        : err.message || "Upload invalide.";
    res.status(status).json({ status: "error", message });
  });
}

module.exports = uploadProductImageOptional;
