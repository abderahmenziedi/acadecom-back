const express = require("express");
const auth = require("../middlewares/auth.middleware");
const enforceActiveAccount = require("../middlewares/enforceActiveAccount.middleware");
const permit = require("../middlewares/role.middleware");
const BillingController = require("../controllers/billing.controller");

const router = express.Router();

router.post(
  "/create-checkout-session",
  auth,
  enforceActiveAccount,
  permit("brand"),
  BillingController.createCheckoutSession,
);

module.exports = router;
