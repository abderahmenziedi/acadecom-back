/**
 * app.js - Express Application Configuration
 *
 * Configures all middleware, routes, and error handling.
 * This file is responsible for setting up the Express app structure,
 * NOT for starting the server (that's in server.js).
 *
 * Security layers:
 * 1. Helmet - HTTP security headers
 * 2. CORS - Cross-Origin Resource Sharing
 * 3. Auth JWT - Token-based authentication
 * 4. RBAC - Role-Based Access Control
 * 5. Global Error Handler - Centralized error management
 */
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
// Route racine (accueil)
app.get("/", (req, res) => {
    res.status(200).json({
        status: "success",
        message: "🎓 Bienvenue sur l'API AcademCom Backend",
        endpoints: {
            health: "GET /health",
            register: "POST /api/v1/auth/register",
            login: "POST /api/v1/auth/login",
            logout: "POST /api/v1/auth/logout",
        },
    });
});

// Route de health check
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "success",
        message: "Serveur en bonne santé ✅",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

// Routes authentification
app.use("/api/v1/auth", authRoutes);

// ─── 5. Routes protégées (exemples) ──────────────────────────────────────────

// Accessible uniquement aux admin
app.get("/api/v1/admin", auth, permit("admin"), (req, res) => {
    res.json({ status: "success", message: `Bienvenue Admin (id: ${req.user.id})` });
});

// Accessible à tous les rôles authentifiés
app.get("/api/v1/dashboard", auth, permit("participant", "brand", "quizmaster", "admin"), (req, res) => {
    res.json({ status: "success", message: `Bienvenue, vous êtes connecté en tant que ${req.user.role}` });
});

// Accessible aux brand et admin
app.get("/api/v1/brand", auth, permit("brand", "admin"), (req, res) => {
    res.json({ status: "success", message: "Espace Brand / Admin" });
});

// Accessible aux quizmaster et admin
app.get("/api/v1/quiz", auth, permit("quizmaster", "admin"), (req, res) => {
    res.json({ status: "success", message: "Espace Quizmaster / Admin" });
});

// ─── 6. Route 404 ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
    next(new ApiError(404, `La route ${req.method} ${req.originalUrl} n'existe pas`));
});

// ─── 7. Middleware global d'erreurs (DOIT être en dernier) ───────────────────
app.use(errorHandler);

module.exports = app;
