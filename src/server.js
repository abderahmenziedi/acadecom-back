/**
 * server.js - Point d'entrée unique.
 * Ce fichier se charge UNIQUEMENT de démarrer le serveur HTTP.
 * Toute la configuration Express est dans src/app.js.
 */
require("dotenv").config();
const app = require("./app");
const logger = require("./utils/logger");

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info(`✅ Serveur démarré sur http://localhost:${PORT} [mode: ${process.env.NODE_ENV || "development"}]`);
});

// Gestion des erreurs non capturées (sécurité serveur)
process.on("unhandledRejection", (reason) => {
  logger.error(`❌ Unhandled Rejection: ${reason}`);
  server.close(() => process.exit(1));
});

process.on("uncaughtException", (err) => {
  logger.error(`❌ Uncaught Exception: ${err.message}`);
  process.exit(1);
});