const fs = require("fs");
const path = require("path");
const multer = require("multer");

const dest = path.join(__dirname, "..", "..", "uploads", "quizmasters");
fs.mkdirSync(dest, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, dest),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const allowed = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
    const safeExt = allowed.includes(ext) ? ext : ".jpg";
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 12)}${safeExt}`);
  },
});

function imageFileFilter(_req, file, cb) {
  const ok = /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype);
  if (!ok) return cb(new Error("Photo : JPEG, PNG, GIF ou WebP uniquement."));
  cb(null, true);
}

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

function uploadQuizmasterPhotoOptional(req, res, next) {
  upload.single("photo")(req, res, (err) => {
    if (!err) return next();
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    const message =
      err.code === "LIMIT_FILE_SIZE" ? "Photo trop volumineuse (max 2 Mo)." : err.message || "Upload invalide.";
    res.status(status).json({ status: "error", message });
  });
}

module.exports = uploadQuizmasterPhotoOptional;
