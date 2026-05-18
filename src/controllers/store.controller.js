const StoreService = require("../services/store.service");
const ParticipantService = require("../services/participant.service");
const asyncHandler = require("../utils/asyncHandler");

const listProducts = asyncHandler(async (req, res) => {
  const data = await StoreService.listProducts({
    page: req.query.page,
    limit: req.query.limit,
    search: req.query.search,
  });
  res.json({ status: "success", data });
});

const getProduct = asyncHandler(async (req, res) => {
  const data = await StoreService.getProduct(req.params.id);
  res.json({ status: "success", data });
});

const createOrder = asyncHandler(async (req, res) => {
  const p = await ParticipantService.resolveParticipant(req.user.id);
  const order = await StoreService.placeOrder(p.id, req.user.id, req.body.items);
  res.status(201).json({ status: "success", data: order });
});

const listOrders = asyncHandler(async (req, res) => {
  const p = await ParticipantService.resolveParticipant(req.user.id);
  const data = await StoreService.listOrders(p.id);
  res.json({ status: "success", data });
});

const getOrder = asyncHandler(async (req, res) => {
  const p = await ParticipantService.resolveParticipant(req.user.id);
  const data = await StoreService.getOrder(p.id, Number(req.params.id));
  res.json({ status: "success", data });
});

module.exports = { listProducts, getProduct, createOrder, listOrders, getOrder };
