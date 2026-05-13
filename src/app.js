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
const authRoutes = require("./routes/auth.routes");
const adminRoutes = require("./routes/admin.routes");
const brandRoutes = require("./routes/brand.routes");
const quizmasterRoutes = require("./routes/quizmaster.routes");
const brandSelfRoutes = require("./routes/brandSelf.routes");
const quizRoutes = require("./routes/quiz.routes");
const questionRoutes = require("./routes/question.routes");
const analyticsRoutes = require("./routes/analytics.routes");
const participantRoutes = require("./routes/participant.routes");
const leaderboardRoutes = require("./routes/leaderboard.routes");
const storeRoutes = require("./routes/store.routes");
const gamificationRoutes = require("./routes/gamification.routes");
const notificationRoutes = require("./routes/notification.routes");

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
            adminUsers: "GET /api/admin/users",
            adminBlock: "PATCH /api/admin/users/:id/block",
            adminUnblock: "PATCH /api/admin/users/:id/unblock",
            adminDelete: "DELETE /api/admin/users/:id",
            adminExportCsv: "GET /api/admin/users/export/csv",
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

// Routes admin (protégées JWT + rôle admin)
app.use("/api/v1/admin", adminRoutes);

// Routes brand management
app.use("/api/v1/admin/brands", brandRoutes);
app.use("/api/v1/admin/quizmasters", quizmasterRoutes);

// Routes brand — Self-service + analytics
app.use("/api/v1/brand", brandSelfRoutes);

// Routes quizmaster — Quiz module
app.use("/api/v1/quizmaster/quizzes", quizRoutes);
app.use("/api/v1/quizmaster/questions", questionRoutes);
app.use("/api/v1/quizmaster/dashboard", analyticsRoutes);

// Routes participant — Module complet (profil, quiz, historique, wallet, recommandations)
app.use("/api/v1/participant", participantRoutes);

// Routes leaderboard — Classements
app.use("/api/v1/leaderboard", leaderboardRoutes);

// Routes store — Marketplace / Boutique
app.use("/api/v1/store", storeRoutes);

// Routes gamification — XP, niveaux, badges
app.use("/api/v1/gamification", gamificationRoutes);

// Routes notifications
app.use("/api/v1/notifications", notificationRoutes);

// ─── 5. Route 404 ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
    next(new ApiError(404, `La route ${req.method} ${req.originalUrl} n'existe pas`));
});

// ─── 7. Middleware global d'erreurs (DOIT être en dernier) ───────────────────
app.use(errorHandler);

module.exports = app;
