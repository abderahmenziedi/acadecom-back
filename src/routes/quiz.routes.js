const express = require("express");
const router = express.Router();
const QuizController = require("../controllers/quiz.controller");
const QuestionController = require("../controllers/question.controller");
const AnalyticsController = require("../controllers/analytics.controller");
const auth = require("../middlewares/auth");
const permit = require("../middlewares/role");
const validate = require("../middlewares/validate");
const { createQuizSchema, updateQuizSchema } = require("../validations/quiz.validation");
const { createQuestionSchema, updateQuestionSchema } = require("../validations/question.validation");

/**
 * Routes Quizmaster — Gestion des quizzes.
 * Toutes les routes sont protégées par `auth` (JWT) + `permit("quizmaster")` (RBAC).
 *
 * POST   /api/v1/quizmaster/quizzes                      — Créer un quiz
 * GET    /api/v1/quizmaster/quizzes                      — Lister mes quizzes
 * GET    /api/v1/quizmaster/quizzes/:id                  — Détails d'un quiz
 * PUT    /api/v1/quizmaster/quizzes/:id                  — Mettre à jour un quiz
 * DELETE /api/v1/quizmaster/quizzes/:id                  — Supprimer un quiz
 * POST   /api/v1/quizmaster/quizzes/:quizId/questions    — Ajouter une question
 * GET    /api/v1/quizmaster/quizzes/:id/analytics        — Analytics d'un quiz
 */

// Middleware appliqué à toutes les routes de ce router
router.use(auth, permit("quizmaster"));

// ─── QUIZ CRUD ────────────────────────────────────────────────────────────────
router.post("/", validate(createQuizSchema), QuizController.create);
router.get("/", QuizController.getAll);
router.get("/:id", QuizController.getById);
router.put("/:id", validate(updateQuizSchema), QuizController.update);
router.delete("/:id", QuizController.delete);

// ─── QUESTIONS (nested under quiz) ────────────────────────────────────────────
router.post("/:quizId/questions", validate(createQuestionSchema), QuestionController.create);

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
router.get("/:id/analytics", AnalyticsController.getQuizAnalytics);

module.exports = router;
