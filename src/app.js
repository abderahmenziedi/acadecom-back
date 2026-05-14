/**
 * app.js — Express Application Configuration
 *
 * Sets up middleware, routes, static uploads and error handling.
 * Server startup lives in server.js.
 *
 * Security layers:
 *  1. Helmet              — HTTP security headers
 *  2. CORS                — Cross-Origin Resource Sharing
 *  3. JWT (auth.js)       — Token-based authentication
 *  4. RBAC (role.js)      — Role-Based Access Control
 *  5. Multer (upload.js)  — File upload sandboxing
 *  6. errorHandler.js     — Centralized error responses
 */
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const multer = require("multer");
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
const profileRoutes = require("./routes/profile.routes");
const uploadRoutes = require("./routes/upload.routes");
const activityRoutes = require("./routes/activity.routes");

// Middlewares
const errorHandler = require("./middlewares/errorHandler");
const ApiError = require("./utils/ApiError");
const { UPLOAD_ROOT } = require("./middlewares/upload");

const app = express();

// ─── 1. Sécurité HTTP ─────────────────────────────────────────────────────────
// Disable crossOriginResourcePolicy so uploaded files load from the frontend origin.
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" },
    })
);

// ─── 2. CORS ──────────────────────────────────────────────────────────────────
const corsOptions = {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));

// ─── 3. Logging & Parsing ─────────────────────────────────────────────────────
app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ─── 4. Static uploads (public files) ─────────────────────────────────────────
app.use(
    "/uploads",
    express.static(UPLOAD_ROOT, {
        maxAge: "7d",
        fallthrough: false,
    })
);

// ─── 5. Public routes ─────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
    res.status(200).json({
        status: "success",
        message: "🎓 Bienvenue sur l'API AcadeCom",
        version: "v1",
        docs: "/api/v1",
    });
});

app.get("/health", (_req, res) => {
    res.status(200).json({
        status: "success",
        message: "Serveur en bonne santé",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

// ─── 6. API routes ────────────────────────────────────────────────────────────
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/admin/brands", brandRoutes);
app.use("/api/v1/admin/quizmasters", quizmasterRoutes);
app.use("/api/v1/brand", brandSelfRoutes);
app.use("/api/v1/quizmaster/quizzes", quizRoutes);
app.use("/api/v1/quizmaster/questions", questionRoutes);
app.use("/api/v1/quizmaster/dashboard", analyticsRoutes);
app.use("/api/v1/participant", participantRoutes);
app.use("/api/v1/leaderboard", leaderboardRoutes);
app.use("/api/v1/store", storeRoutes);
app.use("/api/v1/gamification", gamificationRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/profile", profileRoutes);
app.use("/api/v1/uploads", uploadRoutes);
app.use("/api/v1/activity", activityRoutes);

// ─── 7. 404 ───────────────────────────────────────────────────────────────────
app.use((req, _res, next) => {
    next(new ApiError(404, `La route ${req.method} ${req.originalUrl} n'existe pas`));
});

// ─── 8. Multer errors mapped to ApiError ──────────────────────────────────────
app.use((err, _req, _res, next) => {
    if (err instanceof multer.MulterError) {
        return next(new ApiError(400, `Erreur d'upload: ${err.message}`));
    }
    next(err);
});

// ─── 9. Global error handler (last) ───────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
