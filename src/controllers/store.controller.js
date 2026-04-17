const StoreService = require("../services/store.service");
const ApiError = require("../utils/ApiError");
const { z } = require("zod");

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(50).optional().default(12),
  search: z.string().optional(),
  category: z.string().optional(),
  brandId: z.coerce.number().int().positive().optional(),
});

const createProductSchema = z.object({
  title: z.string().min(2).max(255),
  description: z.string().optional(),
  price: z.number().int().positive(),
  stock: z.number().int().min(0),
  imageUrl: z.string().url().optional().or(z.literal("")),
  category: z.string().max(100).optional(),
});

const orderSchema = z.object({
  items: z.array(z.object({
    productId: z.number().int().positive(),
    quantity: z.number().int().positive().optional().default(1),
  })).min(1),
});

function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const msgs = Object.values(result.error.flatten().fieldErrors).flat();
    throw new ApiError(400, msgs[0] || "Données invalides");
  }
  return result.data;
}

const StoreController = {
  // ─── Public product browsing ─────────────────────────────

  async listProducts(req, res, next) {
    try {
      const filters = parse(paginationSchema, req.query);
      const data = await StoreService.listProducts(filters);
      res.json({ status: "success", data });
    } catch (err) { next(err); }
  },

  async getProduct(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      if (!id) throw new ApiError(400, "ID produit invalide");
      const product = await StoreService.getProduct(id);
      res.json({ status: "success", data: { product } });
    } catch (err) { next(err); }
  },

  async getCategories(req, res, next) {
    try {
      const categories = await StoreService.getCategories();
      res.json({ status: "success", data: { categories } });
    } catch (err) { next(err); }
  },

  // ─── Participant orders ──────────────────────────────────

  async createOrder(req, res, next) {
    try {
      const { items } = parse(orderSchema, req.body);
      const order = await StoreService.createOrder(req.user.id, items);
      res.status(201).json({ status: "success", message: "Commande passée avec succès", data: { order } });
    } catch (err) { next(err); }
  },

  async getOrders(req, res, next) {
    try {
      const filters = parse(paginationSchema, req.query);
      const data = await StoreService.getOrders(req.user.id, filters);
      res.json({ status: "success", data });
    } catch (err) { next(err); }
  },

  async getOrderDetail(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      if (!id) throw new ApiError(400, "ID commande invalide");
      const order = await StoreService.getOrderDetail(id, req.user.id);
      res.json({ status: "success", data: { order } });
    } catch (err) { next(err); }
  },

  // ─── Brand product management ───────────────────────────

  async createProduct(req, res, next) {
    try {
      const data = parse(createProductSchema, req.body);
      const product = await StoreService.createProduct(req.user.id, data);
      res.status(201).json({ status: "success", message: "Produit créé", data: { product } });
    } catch (err) { next(err); }
  },

  async updateProduct(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      if (!id) throw new ApiError(400, "ID produit invalide");
      const data = parse(createProductSchema.partial(), req.body);
      const product = await StoreService.updateProduct(id, req.user.id, data);
      res.json({ status: "success", message: "Produit mis à jour", data: { product } });
    } catch (err) { next(err); }
  },

  async deleteProduct(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      if (!id) throw new ApiError(400, "ID produit invalide");
      await StoreService.deleteProduct(id, req.user.id);
      res.json({ status: "success", message: "Produit supprimé" });
    } catch (err) { next(err); }
  },

  async getBrandProducts(req, res, next) {
    try {
      const filters = parse(paginationSchema, req.query);
      const data = await StoreService.getBrandProducts(req.user.id, filters);
      res.json({ status: "success", data });
    } catch (err) { next(err); }
  },
};

module.exports = StoreController;
