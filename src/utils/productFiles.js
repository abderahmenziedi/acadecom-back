const fs = require("fs").promises;
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");

async function unlinkStoredProductImage(imageUrl) {
  if (typeof imageUrl !== "string" || !imageUrl.startsWith("/uploads/products/")) return;
  const full = path.join(ROOT, imageUrl.replace(/^\//, ""));
  try {
    await fs.unlink(full);
  } catch {
    /* fichier déjà absent ou chemin invalide */
  }
}

module.exports = { unlinkStoredProductImage, ROOT };
