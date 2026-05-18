const QuizmasterService = require("../services/quizmaster.service");
const asyncHandler = require("../utils/asyncHandler");

const list = asyncHandler(async (req, res) => {
  const data = await QuizmasterService.listQuizzes(req.user.id);
  res.json({ status: "success", data });
});

const getOne = asyncHandler(async (req, res) => {
  const data = await QuizmasterService.getQuiz(req.user.id, Number(req.params.id));
  res.json({ status: "success", data });
});

const create = asyncHandler(async (req, res) => {
  const data = await QuizmasterService.createQuiz(req.user.id, req.body);
  res.status(201).json({ status: "success", data });
});

const update = asyncHandler(async (req, res) => {
  const data = await QuizmasterService.updateQuiz(req.user.id, Number(req.params.id), req.body);
  res.json({ status: "success", data });
});

const remove = asyncHandler(async (req, res) => {
  await QuizmasterService.deleteQuiz(req.user.id, Number(req.params.id));
  res.json({ status: "success" });
});

const addQuestion = asyncHandler(async (req, res) => {
  const data = await QuizmasterService.addQuestion(req.user.id, Number(req.params.quizId), req.body);
  res.status(201).json({ status: "success", data });
});

const updateQuestion = asyncHandler(async (req, res) => {
  const data = await QuizmasterService.updateQuestion(req.user.id, Number(req.params.questionId), req.body);
  res.json({ status: "success", data });
});

const deleteQuestion = asyncHandler(async (req, res) => {
  await QuizmasterService.deleteQuestion(req.user.id, Number(req.params.questionId));
  res.json({ status: "success" });
});

module.exports = {
  list,
  getOne,
  create,
  update,
  remove,
  addQuestion,
  updateQuestion,
  deleteQuestion,
};
