const bcrypt = require("bcrypt");
const prisma = require("../prisma/client");
const ApiError = require("../utils/ApiError");

async function changePassword(userId, currentPassword, newPassword) {
  const np = String(newPassword || "");
  if (np.length < 8) throw new ApiError(400, "Nouveau mot de passe trop court (8 caractères minimum)");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, "Utilisateur introuvable");

  const ok = await bcrypt.compare(String(currentPassword || ""), user.password);
  if (!ok) throw new ApiError(400, "Ancien mot de passe incorrect");

  const hashed = await bcrypt.hash(np, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashed },
  });
}

module.exports = { changePassword };
