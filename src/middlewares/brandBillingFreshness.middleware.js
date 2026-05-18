const prisma = require("../prisma/client");
const SubscriptionLifecycle = require("../services/subscriptionLifecycle.service");

/** Expiration / quotas brand à chaque requête importante. */
async function enforceBrandBillingFreshness(req, _res, next) {
  try {
    const role = req.user?.role;
    if (role === "brand") {
      const brand = await prisma.brand.findUnique({
        where: { userId: req.user.id },
        select: { id: true },
      });
      if (brand) await SubscriptionLifecycle.ensureBrandBillingFreshness(brand.id);
    } else if (role === "quizmaster") {
      const brandId = await SubscriptionLifecycle.findBrandIdByQuizmasterUserId(req.user.id);
      if (brandId != null) await SubscriptionLifecycle.ensureBrandBillingFreshness(brandId);
    }
    next();
  } catch (e) {
    next(e);
  }
}

module.exports = enforceBrandBillingFreshness;
