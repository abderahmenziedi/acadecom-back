const ParticipantService = require("../services/participant.service");
const GameService = require("../services/game.service");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");

const profile = asyncHandler(async (req, res) => {
  const data = await ParticipantService.getProfile(req.user.id);
  res.json({
    status: "success",
    data,
  });
});

const patchProfile = asyncHandler(async (req, res) => {
  const photoPath = req.file ? `/uploads/participants/${req.file.filename}` : undefined;
  const data = await ParticipantService.updateParticipantProfile(req.user.id, req.body, photoPath);
  res.json({ status: "success", data });
});

const listQuizzes = asyncHandler(async (req, res) => {
  const p = await ParticipantService.resolveParticipant(req.user.id);
  const data = await ParticipantService.listParticipantQuizzes(p.id);
  res.json({ status: "success", data });
});

const startQuiz = asyncHandler(async (req, res) => {
  const data = await ParticipantService.startQuizAttempt(req.user.id, Number(req.params.quizId));
  res.json({ status: "success", data });
});

const getQuizPlay = asyncHandler(async (req, res) => {
  const p = await ParticipantService.resolveParticipant(req.user.id);
  const data = await ParticipantService.getQuizForPlay(Number(req.params.quizId), p.id);
  res.json({ status: "success", data });
});

const submitPreAnswers = asyncHandler(async (req, res) => {
  const data = await ParticipantService.submitPreQuizAnswers(
    req.user.id,
    Number(req.params.quizId),
    req.body,
  );
  res.json({ status: "success", data });
});

const playQuiz = asyncHandler(async (req, res, next) => {
  const { answers, durationSeconds } = req.body || {};
  if (!Array.isArray(answers)) return next(new ApiError(400, "answers doit être un tableau"));
  const p = await ParticipantService.resolveParticipant(req.user.id);
  const result = await GameService.playQuiz(p.id, Number(req.params.quizId), answers, durationSeconds ?? 0);
  res.status(201).json({ status: "success", data: result });
});

const sessionResult = asyncHandler(async (req, res) => {
  const data = await ParticipantService.getSessionResult(req.user.id, Number(req.params.sessionId));
  res.json({ status: "success", data });
});

const sessions = asyncHandler(async (req, res) => {
  const data = await ParticipantService.listSessions(req.user.id);
  res.json({ status: "success", data });
});

module.exports = {
  profile,
  patchProfile,
  listQuizzes,
  startQuiz,
  getQuizPlay,
  submitPreAnswers,
  playQuiz,
  sessionResult,
  sessions,
};
