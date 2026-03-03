const logger = require("../utils/logger");

/**
 * Middleware global de gestion des erreurs Express (4 paramètres obligatoires).
 * Doit être déclaré EN DERNIER dans app.js.
 * - En développement : renvoie le stack trace complet.
 * - En production : renvoie un message générique pour les erreurs non-opérationnelles.
 */
const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const status = err.status || "error";

    // Toujours logger l'erreur
    logger.error(`[${req.method}] ${req.originalUrl} → ${statusCode} : ${err.message}`);

    if (process.env.NODE_ENV === "development") {
        return res.status(statusCode).json({
            status,
            message: err.message,
            stack: err.stack,
        });
    }

    // En production, masquer les erreurs internes (bugs, crashs Prisma, etc.)
    if (err.isOperational) {
        return res.status(statusCode).json({ status, message: err.message });
    }

    // Erreur inattendue : ne pas exposer les détails
    return res.status(500).json({
        status: "error",
        message: "Une erreur interne est survenue. Veuillez réessayer.",
    });
};

module.exports = errorHandler;
