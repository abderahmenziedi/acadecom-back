const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../prisma/client");
const ApiError = require("../utils/ApiError");

const JWT_EXPIRES = "8h";

async function buildAuthUserPayload(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { brand: true, quizmaster: true, participant: { include: { xpRank: true } } },
  });
  if (!user) throw new ApiError(500, "Utilisateur introuvable après inscription");
  /** @type {Record<string, unknown>} */
  const base = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isBlocked: user.isBlocked,
    brandId: user.brand?.id ?? null,
    quizmasterId: user.quizmaster?.id ?? null,
    participantId: user.participant?.id ?? null,
  };
  if (user.role === "quizmaster" && user.quizmaster) {
    base.quizmasterApprovalStatus = user.quizmaster.approvalStatus;
  }
  return base;
}

async function listBrandsForSignup() {
  const rows = await prisma.brand.findMany({
    select: {
      id: true,
      industry: true,
      user: { select: { name: true } },
    },
    orderBy: { id: "asc" },
  });
  return rows.map((r) => ({ id: r.id, name: r.user?.name ?? "Marque", industry: r.industry }));
}

/**
 * @param {{ email: string, password: string, name: string, role?: string, brandId?: number }} payload
 */
async function register(payload) {
  const { email, password, name, brandId } = payload;
  let role =
    typeof payload.role === "string" ? payload.role.trim().toLowerCase() : "participant";

  if (!["participant", "brand", "quizmaster"].includes(role)) {
    throw new ApiError(400, "Rôle invalide (participant, brand ou quizmaster)");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ApiError(409, "Email déjà utilisé");

  const hashed = await bcrypt.hash(password, 10);
  /** @type {import("@prisma/client").User | null} */
  let created = null;

  if (role === "participant") {
    const firstRank = await prisma.xpRank.findFirst({ orderBy: { minXp: "asc" } });
    if (!firstRank) throw new ApiError(500, "Rangs XP manquants — exécutez le seed");
    created = await prisma.user.create({
      data: {
        email,
        password: hashed,
        name,
        role: "participant",
        participant: {
          create: { xpRankId: firstRank.id },
        },
      },
    });
  } else if (role === "brand") {
    created = await prisma.user.create({
      data: {
        email,
        password: hashed,
        name,
        role: "brand",
        brand: { create: {} },
      },
    });
  } else {
    const bid = typeof brandId === "number" ? brandId : parseInt(String(brandId ?? ""), 10);
    if (!Number.isInteger(bid) || bid < 1) {
      throw new ApiError(400, "brandId obligatoire pour un compte quizmaster");
    }
    const brand = await prisma.brand.findUnique({
      where: { id: bid },
      include: { user: { select: { name: true } } },
    });
    if (!brand) throw new ApiError(404, "Marque introuvable");
    created = await prisma.user.create({
      data: {
        email,
        password: hashed,
        name,
        role: "quizmaster",
        quizmaster: {
          create: {
            brandId: bid,
            approvalStatus: "PENDING",
          },
        },
      },
    });
    await prisma.notification
      .create({
        data: {
          userId: brand.userId,
          type: "quizmaster_pending_approval",
          message: `${name} (${email}) demande à rejoindre votre marque${brand.user?.name ? ` « ${brand.user.name} »` : ""} en tant que quizmaster. Ouvrez le détail pour activer ou refuser.`,
        },
      })
      .catch(() => {});
  }

  const token = jwt.sign({ id: created.id, role: created.role }, process.env.JWT_SECRET, {
    expiresIn: JWT_EXPIRES,
  });
  const profile = await buildAuthUserPayload(created.id);
  return { token, user: profile };
}

/** Profil léger avec statut blocage ; utilisable alors que `enforceActiveAccount` bloque les autres routes. */
async function getAuthSessionSnapshot(userId) {
  return buildAuthUserPayload(userId);
}

async function login({ email, password }) {
  const row = await prisma.user.findUnique({
    where: { email },
    select: { id: true, password: true, role: true, isBlocked: true },
  });
  if (!row) throw new ApiError(401, "Identifiants invalides");

  const ok = await bcrypt.compare(password, row.password);
  if (!ok) throw new ApiError(401, "Identifiants invalides");

  const token = jwt.sign({ id: row.id, role: row.role }, process.env.JWT_SECRET, {
    expiresIn: JWT_EXPIRES,
  });
  const user = await buildAuthUserPayload(row.id);
  return { token, user };
}

module.exports = { register, login, listBrandsForSignup, getAuthSessionSnapshot };
