const express = require("express");
const router = express.Router();
const ParticipantController = require("../controllers/participant.controller");
const auth = require("../middlewares/auth");
const permit = require("../middlewares/role");
const validate = require("../middlewares/validate");
const {
    updateProfileSchema,
    answerQuestionSchema,
    submitAnswersSchema,
} = require("../validations/participant.validation");

/**
 * Routes Participant — Module complet.
 * Toutes les routes sont protégées par `auth` (JWT) + `permit("participant")`.
 *
 * PROFIL
 * GET    /me                                — Mon profil
 * PUT    /me                                — Mettre à jour mon profil
 * GET    /stats                             — Mes statistiques
 *
 * QUIZ PARTICIPATION
 * GET    /quizzes/available                 — Quizzes disponibles
 * POST   /quizzes/:quizId/start             — Démarrer une tentative
 * POST   /attempts/:attemptId/answer        — Répondre à une question
 * POST   /attempts/:attemptId/finish        — Terminer la tentative
 * POST   /attempts/:attemptId/submit        — Soumettre toutes les réponses d'un coup
 * GET    /attempts/:attemptId/result        — Résultat d'une tentative
 *
 * HISTORIQUE
 * GET    /attempts                          — Historique des tentatives
 * GET    /attempts/:id                      — Détail d'une tentative
 *
 * WALLET / POINTS
 * GET    /wallet                            — Solde de points
 * GET    /points-history                    — Historique des points
 *
 * RECOMMANDATIONS
 * GET    /recommendations                   — Quizzes recommandés
 */

router.use(auth, permit("participant"));

// ─── Profil ────────────────────────────────────────────────────────────────────
router.get("/me", ParticipantController.getProfile);
router.put("/me", validate(updateProfileSchema), ParticipantController.updateProfile);
router.get("/stats", ParticipantController.getStats);

// ─── Quiz participation ────────────────────────────────────────────────────────
router.get("/quizzes/available", ParticipantController.listAvailableQuizzes);
router.post("/quizzes/:quizId/start", ParticipantController.startAttempt);

// ─── Tentatives ────────────────────────────────────────────────────────────────
router.post("/attempts/:attemptId/answer", validate(answerQuestionSchema), ParticipantController.answerQuestion);
router.post("/attempts/:attemptId/finish", ParticipantController.finishAttempt);
router.post("/attempts/:attemptId/submit", validate(submitAnswersSchema), ParticipantController.submitAndFinish);
router.get("/attempts/:attemptId/result", ParticipantController.getAttemptResult);

// ─── Historique ────────────────────────────────────────────────────────────────
router.get("/attempts", ParticipantController.getAttempts);
router.get("/attempts/:id", ParticipantController.getAttemptDetail);

// ─── Wallet / Points ───────────────────────────────────────────────────────────
router.get("/wallet", ParticipantController.getWallet);
router.get("/points-history", ParticipantController.getPointsHistory);

// ─── Recommandations ───────────────────────────────────────────────────────────
router.get("/recommendations", ParticipantController.getRecommendations);

module.exports = router;
