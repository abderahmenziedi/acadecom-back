const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.middleware");
const enforceActiveAccount = require("../middlewares/enforceActiveAccount.middleware");
const permit = require("../middlewares/role.middleware");
const uploadParticipantPhotoOptional = require("../middlewares/uploadParticipantPhoto.middleware");
const requireParticipantProfileComplete = require("../middlewares/participantProfileComplete.middleware");
const ParticipantController = require("../controllers/participant.controller");

router.use(auth, enforceActiveAccount, permit("participant"));

router.get("/profile", ParticipantController.profile);
router.patch("/profile", uploadParticipantPhotoOptional, ParticipantController.patchProfile);

router.get("/quizzes", ParticipantController.listQuizzes);
router.post("/quizzes/:quizId/start", requireParticipantProfileComplete, ParticipantController.startQuiz);
router.post("/quiz/:quizId/pre-answers", requireParticipantProfileComplete, ParticipantController.submitPreAnswers);
router.get("/quizzes/:quizId", requireParticipantProfileComplete, ParticipantController.getQuizPlay);
router.post("/quiz/:quizId/play", requireParticipantProfileComplete, ParticipantController.playQuiz);
router.get("/results/:sessionId", ParticipantController.sessionResult);
router.get("/sessions", ParticipantController.sessions);

module.exports = router;
