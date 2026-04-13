const express = require("express");
const router = express.Router();
const QuestionController = require("../controllers/question.controller");
const auth = require("../middlewares/auth");
const permit = require("../middlewares/role");
const validate = require("../middlewares/validate");
const { updateQuestionSchema } = require("../validations/question.validation");

/**
 * Routes Quizmaster — Gestion des questions (standalone, par ID question).
 * Toutes les routes protégées par `auth` (JWT) + `permit("quizmaster")` (RBAC).
 *
 * PUT    /api/v1/quizmaster/questions/:id    — Mettre à jour une question
 * DELETE /api/v1/quizmaster/questions/:id    — Supprimer une question
 */

router.use(auth, permit("quizmaster"));

router.put("/:id", validate(updateQuestionSchema), QuestionController.update);
router.delete("/:id", QuestionController.delete);

module.exports = router;
