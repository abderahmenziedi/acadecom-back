const prisma = require("../prisma/client");
const ApiError = require("../utils/ApiError");
const QuizmasterProfileService = require("../services/quizmasterProfile.service");
const asyncHandler = require("../utils/asyncHandler");

const getApprovalStatus = asyncHandler(async (req, res) => {
  const qm = await prisma.quizmaster.findUnique({
    where: { userId: req.user.id },
    select: { approvalStatus: true, brandId: true, id: true },
  });
  if (!qm) throw new ApiError(403, "Quizmaster introuvable");
  res.json({
    status: "success",
    data: {
      quizmasterId: qm.id,
      brandId: qm.brandId,
      approvalStatus: qm.approvalStatus,
    },
  });
});

const getProfile = asyncHandler(async (req, res) => {
  const data = await QuizmasterProfileService.getQuizmasterProfile(req.user.id);
  res.json({ status: "success", data });
});

const patchProfile = asyncHandler(async (req, res) => {
  const photoPath = req.file ? `/uploads/quizmasters/${req.file.filename}` : undefined;
  const data = await QuizmasterProfileService.updateQuizmasterProfile(req.user.id, req.body, photoPath);
  res.json({ status: "success", data });
});

module.exports = { getApprovalStatus, getProfile, patchProfile };

