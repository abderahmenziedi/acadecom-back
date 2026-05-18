const prisma = require("../prisma/client");
const ApiError = require("../utils/ApiError");

const PLAN_RANK = { FREE: 0, PRO: 1, PRO_PLUS: 2 };

/** @returns {{ maxActiveQuizmasters: number | null, maxActiveQuizzes: number | null }} */
function limitsForPlanType(planType) {
  switch (planType) {
    case "FREE":
      return { maxActiveQuizmasters: 2, maxActiveQuizzes: 5 };
    case "PRO":
      return { maxActiveQuizmasters: 5, maxActiveQuizzes: 20 };
    case "PRO_PLUS":
      return { maxActiveQuizmasters: null, maxActiveQuizzes: null };
    default:
      return { maxActiveQuizmasters: 2, maxActiveQuizzes: 5 };
  }
}

/** Limits & UI : reflètent Brand.planType (tenu à jour par subscriptionLifecycle). */
function effectivePlanType(brand) {
  return brand.planType ?? "FREE";
}

function planRank(planType) {
  return PLAN_RANK[planType] ?? 0;
}

async function countActiveQuizmasters(brandId) {
  return prisma.quizmaster.count({
    where: {
      brandId,
      approvalStatus: "ACTIVE",
      user: { isBlocked: false },
    },
  });
}

async function countActiveQuizzes(brandId) {
  return prisma.quiz.count({
    where: { brandId, isActive: true },
  });
}

async function getBrandPlanRow(brandId) {
  return prisma.brand.findUnique({
    where: { id: brandId },
    select: {
      id: true,
      planType: true,
      subscriptionStatus: true,
      userId: true,
    },
  });
}

async function getSubscriptionOverview(brand) {
  const effective = effectivePlanType(brand);
  const limits = limitsForPlanType(effective);
  const [activeQuizmasters, activeQuizzes] = await Promise.all([
    countActiveQuizmasters(brand.id),
    countActiveQuizzes(brand.id),
  ]);

  const capQm = limits.maxActiveQuizmasters;
  const capQz = limits.maxActiveQuizzes;
  const atQuizmasterCap = capQm != null && activeQuizmasters >= capQm;
  const atQuizCap = capQz != null && activeQuizzes >= capQz;

  return {
    planType: brand.planType,
    subscriptionStatus: brand.subscriptionStatus,
    effectivePlanType: effective,
    maxActiveQuizmasters: capQm,
    maxActiveQuizzes: capQz,
    activeQuizmasters,
    activeQuizzes,
    canActivateMoreQuizmasters: !atQuizmasterCap,
    canActivateMoreQuizzes: !atQuizCap,
    usageQuizmastersLabel:
      capQm == null ? `${activeQuizmasters} (illimité)` : `${activeQuizmasters} / ${capQm}`,
    usageQuizzesLabel: capQz == null ? `${activeQuizzes} (illimité)` : `${activeQuizzes} / ${capQz}`,
  };
}

async function assertCanIncreaseActiveQuizmasters(brandId) {
  const brand = await getBrandPlanRow(brandId);
  if (!brand) throw new ApiError(404, "Marque introuvable");
  const eff = effectivePlanType(brand);
  const { maxActiveQuizmasters } = limitsForPlanType(eff);
  if (maxActiveQuizmasters == null) return;
  const n = await countActiveQuizmasters(brandId);
  if (n >= maxActiveQuizmasters) {
    throw new ApiError(403, "Limite du pack atteinte pour les quizmasters actifs.");
  }
}

/**
 * @param {number} brandId
 * @param {{ wasActive: boolean, willBeActive: boolean }} quizToggle
 */
async function assertActiveQuizBudget(brandId, { wasActive, willBeActive }) {
  if (!willBeActive || wasActive === willBeActive) return;
  const brand = await getBrandPlanRow(brandId);
  if (!brand) throw new ApiError(404, "Marque introuvable");
  const eff = effectivePlanType(brand);
  const { maxActiveQuizzes } = limitsForPlanType(eff);
  if (maxActiveQuizzes == null) return;
  const n = await countActiveQuizzes(brandId);
  if (n >= maxActiveQuizzes) {
    throw new ApiError(403, "Limite du pack atteinte pour les quiz actifs.");
  }
}

module.exports = {
  PLAN_RANK,
  limitsForPlanType,
  effectivePlanType,
  planRank,
  countActiveQuizmasters,
  countActiveQuizzes,
  getSubscriptionOverview,
  assertCanIncreaseActiveQuizmasters,
  assertActiveQuizBudget,
};
