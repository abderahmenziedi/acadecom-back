/**
 * ApiError - Classe d'erreur opérationnelle personnalisée.
 *
 * Utilisée pour représenter les erreurs HTTP attendues (ex: 404, 401, 409...)
 * que l'on souhaite renvoyer au client avec un message clair.
 *
 * isOperational = true  → l'erreur est gérée, le message peut être exposé.
 * isOperational = false → erreur interne critique, le message est masqué en production.
 */
class ApiError extends Error {
    /**
     * @param {number} statusCode - Code HTTP (ex: 400, 401, 403, 404, 409, 500)
     * @param {string} message    - Message humain lisible
     * @param {boolean} isOperational - True pour les erreurs "métier" attendues
     */
    constructor(statusCode, message, isOperational = true) {
        super(message);

        this.name = "ApiError";
        this.statusCode = statusCode;
        this.status = statusCode >= 400 && statusCode < 500 ? "fail" : "error";
        this.isOperational = isOperational;

        // Capture la stack trace sans polluer avec le constructeur lui-même
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = ApiError;
