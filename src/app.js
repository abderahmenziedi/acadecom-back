const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
require("dotenv").config();

// Routes
const authRoutes = require("./routes/auth");

// Middlewares
const auth = require("./middlewares/auth");
const permit = require("./middlewares/role");
const errorHandler = require("./middlewares/errorHandler");
const ApiError = require("./utils/ApiError");

const app = express();

// ─── 1. Sécurité HTTP ─────────────────────────────────────────────────────────
app.use(helmet());

// ─── 2. CORS (à restreindre en production avec la vraie URL du frontend) ──────
const corsOptions = {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));

// ─── 3. Logging & Parsing ─────────────────────────────────────────────────────
app.use(morgan("dev")); // Log HTTP : méthode, route, status, temps
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── 4. Routes publiques ──────────────────────────────────────────────────────
app.use("/api/v1/auth", authRoutes);

// ─── 5. Routes protégées (exemples) ──────────────────────────────────────────

// Accessible uniquement aux ADMIN
app.get("/api/v1/admin", auth, permit("ADMIN"), (req, res) => {
    res.json({ status: "success", message: `Bienvenue Admin (id: ${req.user.id})` });
});

// Accessible à tous les rôles authentifiés
app.get("/api/v1/dashboard", auth, permit("USER", "VISITEUR", "BRAND", "ADMIN"), (req, res) => {
    res.json({ status: "success", message: `Bienvenue, vous êtes connecté en tant que ${req.user.role}` });
});

// Accessible aux BRAND et ADMIN
app.get("/api/v1/brand", auth, permit("BRAND", "ADMIN"), (req, res) => {
    res.json({ status: "success", message: "Espace Brand / Admin" });
});

// ─── 6. Route 404 ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
    next(new ApiError(404, `La route ${req.method} ${req.originalUrl} n'existe pas`));
});

// ─── 7. Middleware global d'erreurs (DOIT être en dernier) ───────────────────
app.use(errorHandler);

module.exports = app;
