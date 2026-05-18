const prisma = require("../prisma/client");
const ApiError = require("../utils/ApiError");
const SubscriptionLifecycle = require("./subscriptionLifecycle.service");

let stripeClient;
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!stripeClient) {
    // eslint-disable-next-line global-require
    const Stripe = require("stripe");
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

/** Sans Stripe local : paiement fictif hors production uniquement (voir README / .env.example). */
function isBillingDevBypass() {
  return process.env.NODE_ENV !== "production" && process.env.BILLING_DEV_MODE === "true";
}

function minorAmountFallbackDev(planType) {
  const pro = Number.parseInt(process.env.DEV_PRICE_PRO_MINOR || "200000", 10);
  const plus = Number.parseInt(process.env.DEV_PRICE_PRO_PLUS_MINOR || "600000", 10);
  const p =
    Number.isFinite(pro) && pro > 0 ? pro : 200000;
  const pp =
    Number.isFinite(plus) && plus > 0 ? plus : 600000;
  return planType === "PRO" ? p : pp;
}

async function applyPlanUpgrade(userId, requestedPlanType) {
  const brand = await prisma.brand.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!brand) throw new ApiError(403, "Compte brand introuvable");

  await SubscriptionLifecycle.applyPaidStripeOrDevCycle({
    brandId: brand.id,
    planType: requestedPlanType,
    paymentDate: new Date(),
    amountMinor: minorAmountFallbackDev(requestedPlanType),
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    currency: process.env.STRIPE_DISPLAY_CURRENCY || "tnd",
  });

  const base = (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");
  return {
    url: `${base}/brand/billing?checkout=success&billing=dev`,
    sessionId: null,
    devMode: true,
  };
}

async function createCheckoutSession(brandUserId, requestedPlanType) {
  await SubscriptionLifecycle.assertPaidCheckoutAllowed(brandUserId, requestedPlanType);

  if (isBillingDevBypass() && !getStripe()) {
    return applyPlanUpgrade(brandUserId, requestedPlanType);
  }

  const stripe = getStripe();
  if (!stripe) {
    throw new ApiError(
      503,
      "Paiement indisponible : ajoutez STRIPE_SECRET_KEY dans acadecom-back/.env ou, pour tester sans Stripe hors production, définissez BILLING_DEV_MODE=true.",
    );
  }

  const brand = await prisma.brand.findUnique({
    where: { userId: brandUserId },
    include: { user: { select: { email: true } } },
  });
  if (!brand) throw new ApiError(403, "Compte brand introuvable");

  const priceIdEnv =
    requestedPlanType === "PRO" ? "STRIPE_PRICE_ID_PRO" : "STRIPE_PRICE_ID_PRO_PLUS";
  const priceId = process.env[priceIdEnv];
  if (!priceId) {
    throw new ApiError(
      503,
      `Variable manquante : ${priceIdEnv} (créez un prix Stripe et renseignez-le).`,
    );
  }

  const base = (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: brand.user.email,
    client_reference_id: String(brand.id),
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: {
      brandId: String(brand.id),
      planType: requestedPlanType,
    },
    success_url: `${base}/brand/billing?checkout=success`,
    cancel_url: `${base}/brand/billing?checkout=cancel`,
  });

  return { url: session.url, sessionId: session.id };
}

async function fulfillCheckoutSession(session) {
  const meta = session.metadata || {};
  const brandId = Number(meta.brandId);
  const planType = meta.planType;
  if (!Number.isInteger(brandId) || brandId < 1) return;
  if (planType !== "PRO" && planType !== "PRO_PLUS") return;

  let pi = session.payment_intent;
  if (pi && typeof pi === "object" && pi.id) pi = pi.id;

  const paymentDateRaw = session.created ? new Date(session.created * 1000) : new Date();

  await SubscriptionLifecycle.applyPaidStripeOrDevCycle({
    brandId,
    planType,
    paymentDate: paymentDateRaw,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: pi || null,
    amountMinor: typeof session.amount_total === "number" ? session.amount_total : 0,
    currency: session.currency || "tnd",
  });
}

module.exports = {
  createCheckoutSession,
  fulfillCheckoutSession,
  getStripe,
  isBillingDevBypass,
};
