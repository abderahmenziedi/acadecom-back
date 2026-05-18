const prisma = require("../prisma/client");
const ApiError = require("../utils/ApiError");
const { unlinkStoredProductImage } = require("../utils/productFiles");
const BrandPlanService = require("./brandPlan.service");
const SubscriptionLifecycle = require("./subscriptionLifecycle.service");

async function resolveBrand(userId) {
  const brand = await prisma.brand.findUnique({ where: { userId } });
  if (!brand) throw new ApiError(403, "Compte brand introuvable");
  return brand;
}

async function getSubscription(userId) {
  const brand = await resolveBrand(userId);
  return BrandPlanService.getSubscriptionOverview(brand);
}

async function getBilling(userId) {
  const brand = await resolveBrand(userId);
  const now = new Date();
  const win = await SubscriptionLifecycle.getActivePaidWindow(prisma, brand.id, now);

  let daysRemaining = null;
  let paidWindowEndsAt = null;
  if (win && win.endDate.getTime() >= now.getTime()) {
    paidWindowEndsAt = win.endDate.toISOString();
    daysRemaining = Math.ceil((win.endDate.getTime() - now.getTime()) / 86400000);
    if (!Number.isFinite(daysRemaining)) daysRemaining = null;
    else daysRemaining = Math.max(0, daysRemaining);
  }

  const baseOv = await BrandPlanService.getSubscriptionOverview(brand);

  const cycles = await prisma.brandSubscriptionCycle.findMany({
    where: { brandId: brand.id },
    orderBy: { id: "desc" },
    select: {
      id: true,
      planType: true,
      lifecycle: true,
      paymentDate: true,
      startDate: true,
      endDate: true,
      amountMinor: true,
      currency: true,
      stripeCheckoutSessionId: true,
    },
  });

  const overview = {
    ...baseOv,
    paidWindowEndsAt,
    paidOn: win?.paymentDate ? win.paymentDate.toISOString() : null,
    daysRemaining,
    currentPaidCyclePlan: win?.planType ?? null,
    subscriptionPackDays: SubscriptionLifecycle.packDurationDays(),
    timeRemainingLabel:
      baseOv.effectivePlanType === "FREE" || paidWindowEndsAt == null
        ? "—"
        : daysRemaining === 0
          ? "expire aujourd'hui"
          : `${daysRemaining} jour(s) restant(s)`,
  };

  return { overview, cycles };
}

async function getDashboard(userId) {
  const brand = await resolveBrand(userId);
  const [quizmasters, quizzes, products] = await Promise.all([
    prisma.quizmaster.count({ where: { brandId: brand.id } }),
    prisma.quiz.count({ where: { brandId: brand.id } }),
    prisma.product.count({ where: { brandId: brand.id } }),
  ]);
  return { brandId: brand.id, quizmasters, quizzes, products };
}

async function listQuizmasters(userId) {
  const brand = await resolveBrand(userId);
  const qms = await prisma.quizmaster.findMany({
    where: { brandId: brand.id },
    include: {
      user: { select: { id: true, email: true, name: true, isBlocked: true } },
      _count: { select: { quizzes: true } },
    },
  });
  return qms.map((qm) => ({
    id: qm.id,
    userId: qm.user.id,
    email: qm.user.email,
    name: qm.user.name,
    isBlocked: qm.user.isBlocked,
    approvalStatus: qm.approvalStatus,
    quizCount: qm._count.quizzes,
  }));
}

async function approveQuizmaster(brandUserId, quizmasterId) {
  const brand = await resolveBrand(brandUserId);
  const qm = await prisma.quizmaster.findFirst({
    where: { id: quizmasterId, brandId: brand.id },
  });
  if (!qm) throw new ApiError(404, "Quizmaster introuvable");
  if (qm.approvalStatus === "ACTIVE") return;
  if (qm.approvalStatus !== "PENDING") {
    throw new ApiError(400, "Seules les demandes en attente peuvent être activées.");
  }

  await BrandPlanService.assertCanIncreaseActiveQuizmasters(brand.id);

  await prisma.quizmaster.update({
    where: { id: qm.id },
    data: { approvalStatus: "ACTIVE" },
  });

  await prisma.notification
    .create({
      data: {
        userId: qm.userId,
        type: "quizmaster_approved",
        message: `Votre compte quizmaster a été accepté — vous pouvez accéder à votre espace et créer des quiz.`,
      },
    })
    .catch(() => {});
}

async function rejectQuizmaster(brandUserId, quizmasterId) {
  const brand = await resolveBrand(brandUserId);
  const qm = await prisma.quizmaster.findFirst({
    where: { id: quizmasterId, brandId: brand.id },
  });
  if (!qm) throw new ApiError(404, "Quizmaster introuvable");
  if (qm.approvalStatus !== "PENDING") {
    throw new ApiError(400, "Seules les demandes en attente peuvent être refusées.");
  }
  await prisma.quizmaster.update({
    where: { id: qm.id },
    data: { approvalStatus: "REJECTED" },
  });
  await prisma.notification
    .create({
      data: {
        userId: qm.userId,
        type: "quizmaster_rejected",
        message: `Votre demande quizmaster a été refusée par la marque.`,
      },
    })
    .catch(() => {});
}

async function blockQuizmaster(brandUserId, quizmasterId) {
  const brand = await resolveBrand(brandUserId);
  const qm = await prisma.quizmaster.findFirst({
    where: { id: quizmasterId, brandId: brand.id },
    include: { user: true },
  });
  if (!qm) throw new ApiError(404, "Quizmaster introuvable");
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: qm.userId }, data: { isBlocked: true } });
    await tx.quiz.updateMany({
      where: { quizmasterId: qm.id },
      data: { isActive: false },
    });
  });
  await prisma.notification
    .create({
      data: {
        userId: qm.userId,
        type: "account_blocked",
        message: "Votre compte quizmaster a été suspendu par la marque.",
      },
    })
    .catch(() => {});
}

async function unblockQuizmaster(brandUserId, quizmasterId) {
  const brand = await resolveBrand(brandUserId);
  const qm = await prisma.quizmaster.findFirst({
    where: { id: quizmasterId, brandId: brand.id },
    include: { user: { select: { isBlocked: true } } },
  });
  if (!qm) throw new ApiError(404, "Quizmaster introuvable");
  if (qm.user.isBlocked) {
    await BrandPlanService.assertCanIncreaseActiveQuizmasters(brand.id);
  }
  await prisma.user.update({
    where: { id: qm.userId },
    data: { isBlocked: false },
  });
}

async function deleteQuizmaster(brandUserId, quizmasterId) {
  const brand = await resolveBrand(brandUserId);
  const qm = await prisma.quizmaster.findFirst({
    where: { id: quizmasterId, brandId: brand.id },
  });
  if (!qm) throw new ApiError(404, "Quizmaster introuvable");
  await prisma.user.delete({ where: { id: qm.userId } });
}

async function listQuizzes(brandUserId) {
  const brand = await resolveBrand(brandUserId);
  const rows = await prisma.quiz.findMany({
    where: { brandId: brand.id },
    orderBy: { id: "desc" },
    include: {
      quizmaster: { include: { user: { select: { name: true, email: true } } } },
      _count: {
        select: {
          questions: true,
          quizAttempts: { where: { completedAt: { not: null } } },
        },
      },
    },
  });
  return rows.map((row) => {
    const { _count, ...rest } = row;
    return {
      ...rest,
      _count: {
        questions: _count.questions,
        sessions: _count.quizAttempts,
      },
    };
  });
}

async function setQuizActive(brandUserId, quizId, isActive) {
  const brand = await resolveBrand(brandUserId);
  const quiz = await prisma.quiz.findFirst({
    where: { id: quizId, brandId: brand.id },
  });
  if (!quiz) throw new ApiError(404, "Quiz introuvable");
  await BrandPlanService.assertActiveQuizBudget(brand.id, {
    wasActive: quiz.isActive,
    willBeActive: isActive,
  });
  return prisma.quiz.update({
    where: { id: quizId },
    data: { isActive },
  });
}

async function deleteQuiz(brandUserId, quizId) {
  const brand = await resolveBrand(brandUserId);
  const quiz = await prisma.quiz.findFirst({
    where: { id: quizId, brandId: brand.id },
  });
  if (!quiz) throw new ApiError(404, "Quiz introuvable");
  await prisma.quiz.delete({ where: { id: quizId } });
}

async function listBrandProducts(userId) {
  const brand = await resolveBrand(userId);
  return prisma.product.findMany({ where: { brandId: brand.id }, orderBy: { id: "desc" } });
}

function parseOptionalDescription(raw) {
  if (raw === undefined || raw === null || raw === "") return null;
  const d = String(raw).trim();
  if (!d) return null;
  if (d.length > 8000) throw new ApiError(400, "Description trop longue (8000 caractères max)");
  return d;
}

function parseProductCreatePayload(data) {
  if (!data || typeof data !== "object") throw new ApiError(400, "Données invalides");
  const name = typeof data.name === "string" ? data.name.trim() : "";
  if (!name) throw new ApiError(400, "Nom du produit requis");

  const couponPrice = Number(data.couponPrice);
  if (!Number.isInteger(couponPrice) || couponPrice < 1) {
    throw new ApiError(400, "Prix en coupons invalide (entier ≥ 1)");
  }

  let stock = data.stock;
  if (stock === undefined || stock === null || stock === "") stock = 0;
  else {
    stock = Number(stock);
    if (!Number.isInteger(stock) || stock < 0) throw new ApiError(400, "Stock invalide");
  }

  const boolActive = parseOptionalBool(data.isActive);

  return {
    name,
    description: parseOptionalDescription(data.description),
    couponPrice,
    stock,
    image: typeof data.image === "string" ? data.image.trim() || null : data.image ?? null,
    isActive: boolActive !== undefined ? boolActive : true,
  };
}

function parseOptionalCouponPrice(v) {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new ApiError(400, "Prix en coupons invalide (entier ≥ 1)");
  return n;
}

function parseOptionalStock(v) {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) throw new ApiError(400, "Stock invalide");
  return n;
}

function parseOptionalBool(raw) {
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (typeof raw === "boolean") return raw;
  const s = String(raw).trim().toLowerCase();
  if (s === "true" || s === "1" || s === "on") return true;
  if (s === "false" || s === "0") return false;
  throw new ApiError(400, "Champ booléen invalide");
}

async function createProduct(userId, data) {
  const brand = await resolveBrand(userId);
  const parsed = parseProductCreatePayload(data);
  return prisma.product.create({
    data: {
      brandId: brand.id,
      name: parsed.name,
      description: parsed.description,
      couponPrice: parsed.couponPrice,
      stock: parsed.stock,
      image: parsed.image,
      isActive: parsed.isActive,
    },
  });
}

async function updateProduct(userId, productId, data) {
  const brand = await resolveBrand(userId);
  const p = await prisma.product.findFirst({ where: { id: productId, brandId: brand.id } });
  if (!p) throw new ApiError(404, "Produit introuvable");
  const couponPrice = parseOptionalCouponPrice(data?.couponPrice);
  const stock = parseOptionalStock(data?.stock);
  const isActive = parseOptionalBool(data?.isActive);
  const patch = {};
  if (data.name != null) {
    const trimmed = String(data.name).trim();
    if (!trimmed) throw new ApiError(400, "Nom du produit requis");
    patch.name = trimmed;
  }
  if (data.description !== undefined) {
    patch.description = parseOptionalDescription(data.description);
  }
  const prevImage = p.image;
  const imageChanging = data.image !== undefined;
  const nextImage = imageChanging
    ? typeof data.image === "string"
      ? data.image.trim() || null
      : data.image
    : undefined;

  const updated = await prisma.product.update({
    where: { id: productId },
    data: {
      ...patch,
      ...(couponPrice !== undefined && { couponPrice }),
      ...(stock !== undefined && { stock }),
      ...(imageChanging && { image: nextImage }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  if (imageChanging && prevImage && prevImage !== updated.image) {
    await unlinkStoredProductImage(prevImage);
  }

  return updated;
}

async function deleteProduct(userId, productId) {
  const brand = await resolveBrand(userId);
  const p = await prisma.product.findFirst({ where: { id: productId, brandId: brand.id } });
  if (!p) throw new ApiError(404, "Produit introuvable");
  await unlinkStoredProductImage(p.image);
  await prisma.product.delete({ where: { id: productId } });
}

module.exports = {
  resolveBrand,
  getDashboard,
  getSubscription,
  getBilling,
  listQuizmasters,
  approveQuizmaster,
  rejectQuizmaster,
  blockQuizmaster,
  unblockQuizmaster,
  deleteQuizmaster,
  listQuizzes,
  setQuizActive,
  deleteQuiz,
  listBrandProducts,
  createProduct,
  updateProduct,
  deleteProduct,
};
