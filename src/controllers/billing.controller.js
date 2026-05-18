const asyncHandler = require("../utils/asyncHandler");
const BillingService = require("../services/billing.service");
const ApiError = require("../utils/ApiError");

const createCheckoutSession = asyncHandler(async (req, res) => {
  const planType = req.body?.planType;
  const data = await BillingService.createCheckoutSession(req.user.id, planType);
  res.status(201).json({ status: "success", data });
});

const webhook = asyncHandler(async (req, res) => {
  const stripe = BillingService.getStripe();
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !whSecret) {
    throw new ApiError(503, "Webhook Stripe non configuré.");
  }

  const sig = req.headers["stripe-signature"];
  if (!sig) throw new ApiError(400, "Signature Stripe manquante.");

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, whSecret);
  } catch (err) {
    throw new ApiError(400, `Webhook Stripe invalide : ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    await BillingService.fulfillCheckoutSession(session);
  }

  res.json({ received: true });
});

module.exports = { createCheckoutSession, webhook };
