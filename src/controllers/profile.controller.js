const UserPasswordService = require("../services/userPassword.service");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");

const changePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body || {};
  if (currentPassword == null || newPassword == null) {
    return next(new ApiError(400, "currentPassword et newPassword requis"));
  }
  await UserPasswordService.changePassword(req.user.id, currentPassword, newPassword);
  res.json({ status: "success", message: "Mot de passe mis à jour" });
});

module.exports = { changePassword };
