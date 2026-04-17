const express = require("express");
const router = express.Router();
const StoreController = require("../controllers/store.controller");
const auth = require("../middlewares/auth");
const permit = require("../middlewares/role");

/**
 * Store Routes — Marketplace
 *
 * PUBLIC (authenticated)
 * GET    /products              — Browse products
 * GET    /products/categories   — List categories
 * GET    /products/:id          — Product detail
 *
 * PARTICIPANT
 * POST   /orders                — Place order
 * GET    /orders                — My orders
 * GET    /orders/:id            — Order detail
 *
 * BRAND
 * GET    /brand/products        — My products
 * POST   /brand/products        — Create product
 * PUT    /brand/products/:id    — Update product
 * DELETE /brand/products/:id    — Delete product
 */

// Authenticated product browsing
router.get("/products", auth, StoreController.listProducts);
router.get("/products/categories", auth, StoreController.getCategories);
router.get("/products/:id", auth, StoreController.getProduct);

// Participant orders
router.post("/orders", auth, permit("participant"), StoreController.createOrder);
router.get("/orders", auth, permit("participant"), StoreController.getOrders);
router.get("/orders/:id", auth, permit("participant"), StoreController.getOrderDetail);

// Brand product management
router.get("/brand/products", auth, permit("brand"), StoreController.getBrandProducts);
router.post("/brand/products", auth, permit("brand"), StoreController.createProduct);
router.put("/brand/products/:id", auth, permit("brand"), StoreController.updateProduct);
router.delete("/brand/products/:id", auth, permit("brand"), StoreController.deleteProduct);

module.exports = router;
