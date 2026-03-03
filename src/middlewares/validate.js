/**
 * Middleware de validation générique basé sur les schémas Zod.
 * Valide req.body par défaut. Retourne 400 avec les erreurs si invalide.
 * @param {import("zod").ZodSchema} schema - Le schéma Zod à appliquer
 */
const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({
            status: "fail",
            errors: result.error.errors.map((e) => ({
                champ: e.path.join("."),
                message: e.message,
            })),
        });
    }
    req.body = result.data; // Remplace par les données nettoyées et validées
    next();
};

module.exports = validate;
