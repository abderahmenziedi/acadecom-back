const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.middleware");
const enforceActiveAccount = require("../middlewares/enforceActiveAccount.middleware");
const permit = require("../middlewares/role.middleware");
const StoreController = require("../controllers/store.controller");

router.get("/products", StoreController.listProducts);
router.get("/products/:id", StoreController.getProduct);

router.post("/orders", auth, enforceActiveAccount, permit("participant"), StoreController.createOrder);
router.get("/orders", auth, enforceActiveAccount, permit("participant"), StoreController.listOrders);
router.get("/orders/:id", auth, enforceActiveAccount, permit("participant"), StoreController.getOrder);

module.exports = router;
