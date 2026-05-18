require("dotenv").config();

if (!process.env.JWT_SECRET || !process.env.DATABASE_URL) {
  console.error("Variables manquantes: JWT_SECRET ou DATABASE_URL");
  process.exit(1);
}

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const ApiError = require("./utils/ApiError");
const errorMiddleware = require("./middlewares/error.middleware");

const authRoutes = require("./routes/auth.routes");
const adminRoutes = require("./routes/admin.routes");
const brandRoutes = require("./routes/brand.routes");
const quizmasterRoutes = require("./routes/quizmaster.routes");
const participantRoutes = require("./routes/participant.routes");
const profileRoutes = require("./routes/profile.routes");
const storeRoutes = require("./routes/store.routes");
const leaderboardRoutes = require("./routes/leaderboard.routes");
const notificationRoutes = require("./routes/notification.routes");
const billingRoutes = require("./routes/billing.routes");

const app = express();

const API = "/api/v1";
const billingController = require("./controllers/billing.controller");

/** Stripe webhook reçoit le corps brut (signature). */
app.post(`${API}/billing/webhook`, express.raw({ type: "application/json" }), billingController.webhook);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(
  cors({
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/", (_req, res) => {
  res.json({
    status: "success",
    message: "API AcadeCom",
    docs: `${API}`,
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "success", uptime: process.uptime() });
});

app.use(`${API}/auth`, authRoutes);
app.use(`${API}/admin`, adminRoutes);
app.use(`${API}/brand`, brandRoutes);
app.use(`${API}/quizmaster`, quizmasterRoutes);
app.use(`${API}/participant`, participantRoutes);
app.use(`${API}/profile`, profileRoutes);
app.use(`${API}/store`, storeRoutes);
app.use(`${API}/leaderboard`, leaderboardRoutes);
app.use(`${API}/notifications`, notificationRoutes);
app.use(`${API}/billing`, billingRoutes);

app.use((req, _res, next) => {
  next(new ApiError(404, `Route introuvable: ${req.method} ${req.originalUrl}`));
});

app.use(errorMiddleware);

module.exports = app;
