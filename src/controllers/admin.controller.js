const AdminService = require("../services/admin.service");
const asyncHandler = require("../utils/asyncHandler");

const listUsers = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const role = req.query.role || undefined;
  const data = await AdminService.listUsers({ page, limit, role });
  res.json({ status: "success", data });
});

const exportCsv = asyncHandler(async (_req, res) => {
  const csv = await AdminService.exportCsv();
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=users.csv");
  res.send(csv);
});

const blockUser = asyncHandler(async (req, res) => {
  const data = await AdminService.blockUser(req.user.id, Number(req.params.id));
  res.json({ status: "success", ...data });
});

const unblockUser = asyncHandler(async (req, res) => {
  const data = await AdminService.unblockUser(req.user.id, Number(req.params.id));
  res.json({ status: "success", ...data });
});

const deleteUser = asyncHandler(async (req, res) => {
  await AdminService.deleteUser(req.user.id, Number(req.params.id));
  res.json({ status: "success" });
});

module.exports = { listUsers, exportCsv, blockUser, unblockUser, deleteUser };
