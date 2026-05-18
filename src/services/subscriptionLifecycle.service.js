const prisma = require("../prisma/client");
const BrandPlanService = require("./brandPlan.service");

/** Durée du pack payant après paiement / renouvellement (jours). */
function packDurationDays() {
  const n = parseInt(process.env.SUBSCRIPTION_PACK_DAYS || "30", 10);
  if (!Number.isInteger(n) || n < 1 || n > 3650) return 30;
  return n;
}

function utcEndOfPaidWindow(start, durationDays) {
  const startUtc = new Date(start.getTime());
  startUtc.setUTCDate(startUtc.getUTCDate() + durationDays);
  return startUtc;
}

async function getActivePaidWindow(tx, brandId, now = new Date()) {
  const client = tx || prisma;
  return client.brandSubscriptionCycle.findFirst({
    where: {
      brandId,
      lifecycle: "ACTIVE",
      startDate: { lte: now },
      endDate: { gte: now },
    },
    orderBy: { id: "desc" },
  });
}

async function notifyUserSafe(userId, type, message) {
  await prisma.notification
    .create({
      data: { userId, type, message },
    })
    .catch(() => {});
}

/**
 * Coupe les quizzes / QM actifs qui dépassent les plafonds du plan effective.
 */
async function clampBrandToLimits(tx, brandId, limits) {
  const capQz = limits.maxActiveQuizzes;
  const capQm = limits.maxActiveQuizmasters;

  if (capQz != null) {
    const activeIds = (
      await tx.quiz.findMany({
        where: { brandId, isActive: true },
        select: { id: true },
        orderBy: { id: "asc" },
      })
    ).map((r) => r.id);
    const toOff = activeIds.slice(capQz);
    if (toOff.length) {
      await tx.quiz.updateMany({
        where: { id: { in: toOff }, brandId },
        data: { isActive: false },
      });
    }
  }

  if (capQm != null) {
    const qmsSorted = (
      await tx.quizmaster.findMany({
        where: { brandId, approvalStatus: "ACTIVE", user: { isBlocked: false } },
        select: { id: true },
        orderBy: { id: "asc" },
      })
    ).map((r) => r.id);

    const toBlockQmIds = qmsSorted.slice(capQm);
    for (const qmId of toBlockQmIds) {
      const row = await tx.quizmaster.findUnique({
        where: { id: qmId },
        select: { userId: true },
      });
      if (!row) continue;
      await tx.user.update({
        where: { id: row.userId },
        data: { isBlocked: true },
      });
      await tx.quiz.updateMany({
        where: { quizmasterId: qmId },
        data: { isActive: false },
      });
    }
  }
}

/**
 * À chaque action « importante » brand / quizmaster payante : expire, maj Brand, quotas.
 */
async function ensureBrandBillingFreshness(brandId) {
  await prisma.$transaction(async (tx) => {
    const now = new Date();

    const aboutToExpire = await tx.brandSubscriptionCycle.findMany({
      where: {
        brandId,
        lifecycle: "ACTIVE",
        endDate: { lt: now },
      },
      select: { id: true },
    });

    if (aboutToExpire.length) {
      await tx.brandSubscriptionCycle.updateMany({
        where: {
          brandId,
          lifecycle: "ACTIVE",
          endDate: { lt: now },
        },
        data: { lifecycle: "EXPIRED" },
      });
      const b = await tx.brand.findUnique({
        where: { id: brandId },
        select: { userId: true },
      });
      if (b) {
        await notifyUserSafe(
          b.userId,
          "subscription_expired",
          "Votre abonnement payant a expiré. Passage automatique au pack gratuit — les quotas supplémentaires ont été désactivés.",
        );
      }
    }

    const paidWindow = await getActivePaidWindow(tx, brandId, now);

    let effectivePlanType = paidWindow?.planType ?? "FREE";

    const totalCycles = await tx.brandSubscriptionCycle.count({ where: { brandId } });
    let nextSubStatus =
      paidWindow != null ? "ACTIVE" : totalCycles > 0 ? "EXPIRED" : "ACTIVE";

    await tx.brand.update({
      where: { id: brandId },
      data: {
        planType: effectivePlanType,
        subscriptionStatus: nextSubStatus,
      },
    });

    const limitsNow = BrandPlanService.limitsForPlanType(effectivePlanType);
    await clampBrandToLimits(tx, brandId, limitsNow);

    const winStill = paidWindow ?? (await getActivePaidWindow(tx, brandId, now));
    if (
      winStill &&
      winStill.endDate.getTime() >= now.getTime() &&
      !winStill.expiryWarnedAt
    ) {
      const msPerDay = 86400000;
      const remaining = Math.ceil((winStill.endDate.getTime() - now.getTime()) / msPerDay);
      if (remaining <= 3 && remaining >= 0) {
        const bUser = await tx.brand.findUnique({
          where: { id: brandId },
          select: { userId: true },
        });
        if (bUser)
          await notifyUserSafe(
            bUser.userId,
            "subscription_expiring",
            remaining === 0
              ? `Votre pack ${winStill.planType} expire aujourd’hui — renouvelez pour éviter les limites gratuites.`
              : `Votre pack ${winStill.planType} expire dans ${remaining} jour(s).`,
          );

        await tx.brandSubscriptionCycle.update({
          where: { id: winStill.id },
          data: { expiryWarnedAt: now },
        });
      }
    }
  });
}

async function assertPaidCheckoutAllowed(userId, planTypeRequested) {
  if (planTypeRequested !== "PRO" && planTypeRequested !== "PRO_PLUS") {
    const ApiError = require("../utils/ApiError");
    throw new ApiError(400, "planType invalide (PRO ou PRO_PLUS attendu).");
  }

  const brand = await prisma.brand.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!brand) {
    const ApiError = require("../utils/ApiError");
    throw new ApiError(403, "Compte brand introuvable");
  }

  await ensureBrandBillingFreshness(brand.id);

  const now = new Date();
  const win = await getActivePaidWindow(prisma, brand.id, now);
  if (
    win &&
    win.lifecycle === "ACTIVE" &&
    win.planType === planTypeRequested &&
    win.endDate.getTime() >= now.getTime()
  ) {
    const ApiError = require("../utils/ApiError");
    const endFmt = win.endDate.toISOString().slice(0, 10);
    throw new ApiError(409, `Vous êtes déjà sous ce pack actif jusqu'au ${endFmt}. Patientez jusqu'à expiration ou choisissez un autre plan.`);
  }
}

async function applyPaidStripeOrDevCycle({
  brandId,
  planType,
  paymentDate = new Date(),
  stripeCheckoutSessionId,
  stripePaymentIntentId,
  amountMinor,
  currency = "tnd",
}) {
  if (planType !== "PRO" && planType !== "PRO_PLUS") throw new Error("cycle payant réservé à PRO / PRO_PLUS");

  await prisma.$transaction(async (tx) => {
    if (stripeCheckoutSessionId) {
      const dup = await tx.brandSubscriptionCycle.findUnique({
        where: { stripeCheckoutSessionId },
      });
      if (dup) return;
    }

    await tx.brandSubscriptionCycle.updateMany({
      where: { brandId, lifecycle: "ACTIVE" },
      data: { lifecycle: "SUPERSEDED" },
    });

    const start = paymentDate instanceof Date ? paymentDate : new Date(paymentDate);
    const dur = packDurationDays();
    const end = utcEndOfPaidWindow(start, dur);

    await tx.brandSubscriptionCycle.create({
      data: {
        brandId,
        planType,
        lifecycle: "ACTIVE",
        paymentDate: start,
        startDate: start,
        endDate: end,
        amountMinor,
        currency: String(currency || "tnd").toLowerCase(),
        stripeCheckoutSessionId,
        stripePaymentIntentId,
        expiryWarnedAt: null,
      },
    });

    const win = await getActivePaidWindow(tx, brandId);
    if (!win) throw new Error("subscription cycle créé mais fenêtre ACTIVE introuvable");

    await tx.brand.update({
      where: { id: brandId },
      data: {
        planType: win.planType,
        subscriptionStatus: "ACTIVE",
      },
    });

    const limitsNow = BrandPlanService.limitsForPlanType(win.planType);
    await clampBrandToLimits(tx, brandId, limitsNow);
  });
}

async function findBrandIdByQuizmasterUserId(userId) {
  const row = await prisma.quizmaster.findUnique({
    where: { userId },
    select: { brandId: true },
  });
  return row?.brandId ?? null;
}

module.exports = {
  packDurationDays,
  getActivePaidWindow,
  ensureBrandBillingFreshness,
  assertPaidCheckoutAllowed,
  applyPaidStripeOrDevCycle,
  findBrandIdByQuizmasterUserId,
};
