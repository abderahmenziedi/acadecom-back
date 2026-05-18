const BrandService = require("../services/brand.service");
const asyncHandler = require("../utils/asyncHandler");
const { requirePositiveIntParam } = require("../utils/paramId");

const dashboard = asyncHandler(async (req, res) => {
  const data = await BrandService.getDashboard(req.user.id);
  res.json({ status: "success", data });
});

const quizmasters = asyncHandler(async (req, res) => {
  const data = await BrandService.listQuizmasters(req.user.id);
  res.json({ status: "success", data });
});

const approveQm = asyncHandler(async (req, res) => {
  await BrandService.approveQuizmaster(
    req.user.id,
    requirePositiveIntParam(req.params.id, "Quizmaster"),
  );
  res.json({ status: "success" });
});

const rejectQm = asyncHandler(async (req, res) => {
  await BrandService.rejectQuizmaster(
    req.user.id,
    requirePositiveIntParam(req.params.id, "Quizmaster"),
  );
  res.json({ status: "success" });
});

const blockQm = asyncHandler(async (req, res) => {
  await BrandService.blockQuizmaster(req.user.id, requirePositiveIntParam(req.params.id, "Quizmaster"));
  res.json({ status: "success" });
});

const unblockQm = asyncHandler(async (req, res) => {
  await BrandService.unblockQuizmaster(req.user.id, requirePositiveIntParam(req.params.id, "Quizmaster"));
  res.json({ status: "success" });
});

const deleteQm = asyncHandler(async (req, res) => {
  await BrandService.deleteQuizmaster(req.user.id, requirePositiveIntParam(req.params.id, "Quizmaster"));
  res.json({ status: "success" });
});

const quizzes = asyncHandler(async (req, res) => {
  const data = await BrandService.listQuizzes(req.user.id);
  res.json({ status: "success", data });
});

const activateQuiz = asyncHandler(async (req, res) => {
  await BrandService.setQuizActive(req.user.id, requirePositiveIntParam(req.params.id, "Quiz"), true);
  res.json({ status: "success" });
});

const deactivateQuiz = asyncHandler(async (req, res) => {
  await BrandService.setQuizActive(req.user.id, requirePositiveIntParam(req.params.id, "Quiz"), false);
  res.json({ status: "success" });
});

const deleteQuiz = asyncHandler(async (req, res) => {
  await BrandService.deleteQuiz(req.user.id, requirePositiveIntParam(req.params.id, "Quiz"));
  res.json({ status: "success" });
});

const subscription = asyncHandler(async (req, res) => {
  const data = await BrandService.getSubscription(req.user.id);
  res.json({ status: "success", data });
});

const billing = asyncHandler(async (req, res) => {
  const data = await BrandService.getBilling(req.user.id);
  res.json({ status: "success", data });
});

const products = asyncHandler(async (req, res) => {
  const data = await BrandService.listBrandProducts(req.user.id);
  res.json({ status: "success", data });
});

const createProduct = asyncHandler(async (req, res) => {
  const body = { ...(typeof req.body === "object" && req.body ? req.body : {}) };
  if (req.file) body.image = `/uploads/products/${req.file.filename}`;
  const row = await BrandService.createProduct(req.user.id, body);
  res.status(201).json({ status: "success", data: row });
});

const updateProduct = asyncHandler(async (req, res) => {
  const body = { ...(typeof req.body === "object" && req.body ? req.body : {}) };
  if (req.file) body.image = `/uploads/products/${req.file.filename}`;
  else if (body.removeImage === "true" || body.removeImage === true) {
    body.image = "";
  }
  delete body.removeImage;
  const row = await BrandService.updateProduct(
    req.user.id,
    requirePositiveIntParam(req.params.id, "Produit"),
    body,
  );
  res.json({ status: "success", data: row });
});

const deleteProduct = asyncHandler(async (req, res) => {
  await BrandService.deleteProduct(req.user.id, requirePositiveIntParam(req.params.id, "Produit"));
  res.json({ status: "success" });
});

module.exports = {
  dashboard,
  subscription,
  billing,
  quizmasters,
  approveQm,
  rejectQm,
  blockQm,
  unblockQm,
  deleteQm,
  quizzes,
  activateQuiz,
  deactivateQuiz,
  deleteQuiz,
  products,
  createProduct,
  updateProduct,
  deleteProduct,
};
