/**
 * logger.js — Logger applicatif simple.
 *
 * Utilise winston si disponible, sinon fallback sur console.
 * Usage : logger.info("message"), logger.error("message"), logger.warn("message")
 */

let logger;

try {
    const winston = require("winston");

    logger = winston.createLogger({
        level: process.env.LOG_LEVEL || "info",
        format: winston.format.combine(
            winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
            winston.format.colorize(),
            winston.format.printf(
                ({ timestamp, level, message }) => `[${timestamp}] ${level}: ${message}`
            )
        ),
        transports: [new winston.transports.Console()],
    });
} catch {
    // Fallback si winston n'est pas installé
    const prefix = (level) =>
        `[${new Date().toISOString()}] ${level.toUpperCase()}:`;

    logger = {
        info: (...args) => console.log(prefix("info"), ...args),
        warn: (...args) => console.warn(prefix("warn"), ...args),
        error: (...args) => console.error(prefix("error"), ...args),
        debug: (...args) => console.debug(prefix("debug"), ...args),
    };
}

module.exports = logger;
