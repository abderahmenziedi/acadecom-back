/**
 * asyncHandler - Wrapper pour éviter les try/catch répétitifs
 * Capture automatiquement les erreurs async et les passe au middleware d'erreurs
 * 
 * Usage :
 * router.get('/', asyncHandler(async (req, res) => {
 *   const data = await someAsyncOp();
 *   res.json(data);
 * }));
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
