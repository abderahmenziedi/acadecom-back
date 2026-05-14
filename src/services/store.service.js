const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const NotificationService = require("./notification.service");
const ActivityLogService = require("./activityLog.service");
const { deleteByPublicUrl } = require("../middlewares/upload");

/**
 * StoreService — Marketplace logic for products, cart, and orders.
 */
const StoreService = {
  // ═══════════════════════════════════════════════════════════
  // PRODUCTS (public browsing)
  // ═══════════════════════════════════════════════════════════

  async listProducts({ page = 1, limit = 12, search, category, brandId }) {
    const where = { isActive: true, stock: { gt: 0 } };
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }
    if (category) where.category = category;
    if (brandId) where.brandId = brandId;

    const skip = (page - 1) * limit;

    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          description: true,
          price: true,
          stock: true,
          imageUrl: true,
          category: true,
          brand: { select: { id: true, name: true } },
          createdAt: true,
        },
      }),
      prisma.product.count({ where }),
    ]);

    return { products, total, page, totalPages: Math.ceil(total / limit) };
  },

  async getProduct(productId) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        stock: true,
        imageUrl: true,
        category: true,
        isActive: true,
        brand: { select: { id: true, name: true, industry: true } },
        createdAt: true,
      },
    });
    if (!product) throw new ApiError(404, "Produit introuvable");
    return product;
  },

  async getCategories() {
    const categories = await prisma.product.findMany({
      where: { isActive: true },
      select: { category: true },
      distinct: ["category"],
    });
    return categories.map((c) => c.category).filter(Boolean);
  },

  // ═══════════════════════════════════════════════════════════
  // ORDERS (participant purchases)
  // ═══════════════════════════════════════════════════════════

  async createOrder(userId, items) {
    if (!items || items.length === 0) {
      throw new ApiError(400, "Le panier est vide");
    }

    // Fetch all products
    const productIds = items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
    });

    if (products.length !== productIds.length) {
      throw new ApiError(400, "Un ou plusieurs produits sont invalides ou indisponibles");
    }

    const productMap = new Map(products.map((p) => [p.id, p]));
    let totalPrice = 0;
    const orderItems = [];

    for (const item of items) {
      const product = productMap.get(item.productId);
      const qty = item.quantity || 1;

      if (product.stock < qty) {
        throw new ApiError(400, `Stock insuffisant pour "${product.title}" (disponible: ${product.stock})`);
      }

      totalPrice += product.price * qty;
      orderItems.push({
        productId: product.id,
        quantity: qty,
        price: product.price,
      });
    }

    // Check user coupons
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { coupons: true },
    });

    if (user.coupons < totalPrice) {
      throw new ApiError(400, `Coupons insuffisants (solde: ${user.coupons}, coût: ${totalPrice})`);
    }

    // Transaction: create order + deduct coupons + update stock + points history
    const [order] = await prisma.$transaction([
      prisma.order.create({
        data: {
          userId,
          totalPrice,
          status: "confirmed",
          items: { create: orderItems },
        },
        include: {
          items: {
            include: { product: { select: { id: true, title: true, imageUrl: true } } },
          },
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { coupons: { decrement: totalPrice } },
      }),
      // Decrement stock for each product
      ...items.map((item) =>
        prisma.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity || 1 } },
        })
      ),
      prisma.pointsHistory.create({
        data: {
          userId,
          points: -totalPrice,
          reason: `Achat boutique (${orderItems.length} article(s))`,
        },
      }),
    ]);

    // Notifications fan-out (best effort)
    try {
      const participant = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });
      const brandIds = [...new Set(products.map((p) => p.brandId))];
      await NotificationService.notifyOrderConfirmed({
        userId,
        orderId: order.id,
        totalPrice,
      });
      await NotificationService.notifyCouponUsed({
        brandIds,
        participantName: participant?.name,
        totalPrice,
        items: orderItems.map((oi) => {
          const p = productMap.get(oi.productId);
          return { title: p?.title, quantity: oi.quantity };
        }),
      });
      await ActivityLogService.log({
        actorId: userId,
        scopeId: brandIds[0] || null,
        action: "participant_order",
        entityType: "order",
        entityId: order.id,
        metadata: { totalPrice, items: orderItems.length },
      });
    } catch (_) { /* ignore */ }

    return order;
  },

  async getOrders(userId, { page = 1, limit = 10 }) {
    const skip = (page - 1) * limit;
    const where = { userId };

    const [orders, total] = await prisma.$transaction([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          items: {
            include: { product: { select: { id: true, title: true, imageUrl: true } } },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    return { orders, total, page, totalPages: Math.ceil(total / limit) };
  },

  async getOrderDetail(orderId, userId) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { product: { select: { id: true, title: true, imageUrl: true, description: true } } },
        },
      },
    });
    if (!order) throw new ApiError(404, "Commande introuvable");
    if (order.userId !== userId) throw new ApiError(403, "Accès refusé");
    return order;
  },

  // ═══════════════════════════════════════════════════════════
  // BRAND PRODUCT MANAGEMENT
  // ═══════════════════════════════════════════════════════════

  async createProduct(brandId, data) {
    return prisma.product.create({
      data: { ...data, brandId },
    });
  },

  async updateProduct(productId, brandId, data) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new ApiError(404, "Produit introuvable");
    if (product.brandId !== brandId) throw new ApiError(403, "Ce produit ne vous appartient pas");

    return prisma.product.update({
      where: { id: productId },
      data,
    });
  },

  async deleteProduct(productId, brandId) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new ApiError(404, "Produit introuvable");
    if (product.brandId !== brandId) throw new ApiError(403, "Ce produit ne vous appartient pas");

    await prisma.product.update({
      where: { id: productId },
      data: { isActive: false },
    });
  },

  async getBrandProducts(brandId, { page = 1, limit = 20 }) {
    const skip = (page - 1) * limit;
    const where = { brandId };

    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          description: true,
          price: true,
          stock: true,
          imageUrl: true,
          category: true,
          isActive: true,
          createdAt: true,
          _count: { select: { orderItems: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return { products, total, page, totalPages: Math.ceil(total / limit) };
  },
};

module.exports = StoreService;
