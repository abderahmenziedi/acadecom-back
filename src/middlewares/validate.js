/**
 * Middleware de validation générique basé sur les schémas Zod.
 * Valide req.body par défaut. Retourne 400 avec les erreurs si invalide.
 * @param {import("zod").ZodSchema} schema - Le schéma Zod à appliquer
 */
const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
        const flattened = result.error.flatten();
        const errors = [];
        
        // Ajouter les erreurs de formulaire
        if (flattened.formErrors?.length > 0) {
            errors.push(...flattened.formErrors.map((msg) => ({
                champ: "general",
                message: msg,
            })));
        }
        
        // Ajouter les erreurs de champs
        Object.entries(flattened.fieldErrors || {}).forEach(([field, messages]) => {
            if (Array.isArray(messages)) {
                messages.forEach((msg) => {
                    errors.push({
                        champ: field,
                        message: msg,
                    });
                });
            }
        });
        
        return res.status(400).json({
            status: "fail",
            errors: errors.length > 0 ? errors : [{ champ: "general", message: "Erreur de validation" }],
        });
    }
    req.body = result.data; // Remplace par les données nettoyées et validées
    next();
};

module.exports = validate;
