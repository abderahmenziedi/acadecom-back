const express = require("express");
const router = express.Router();
const AuthController = require("../controllers/auth.controller");
const auth = require("../middlewares/auth.middleware");

router.get("/signup/brands", AuthController.signupBrands);
router.post("/register", AuthController.register);
router.post("/login", AuthController.login);
router.get("/session", auth, AuthController.session);
router.post("/logout", auth, AuthController.logout);

module.exports = router;
