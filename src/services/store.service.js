const prisma = require("../prisma/client");
const ApiError = require("../utils/ApiError");

async function listProducts(filters = {}) {
  const page = Number(filters.page) || 1;
  const limit = Number(filters.limit) || 24;
  const skip = (page - 1) * limit;

  const where = { isActive: true, stock: { gt: 0 } };
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search } },
      { brand: { user: { name: { contains: filters.search } } } },
    ];
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: { id: "desc" },
      include: {
        brand: { include: { user: { select: { name: true } } } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return { products, total, page, pages: Math.ceil(total / limit) };
}

async function getProduct(productId) {
  const p = await prisma.product.findUnique({
    where: { id: Number(productId) },
    include: { brand: { include: { user: { select: { name: true } } } } },
  });
  if (!p || !p.isActive) throw new ApiError(404, "Produit introuvable");
  return p;
}

async function placeOrder(participantDbId, userId, items) {
  if (!items?.length) throw new ApiError(400, "Panier vide");

  const participant = await prisma.participant.findUnique({
    where: { id: participantDbId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!participant?.user) throw new ApiError(404, "Participant introuvable");

  let totalCoupons = 0;
  const lines = [];

  for (const line of items) {
    const product = await prisma.product.findUnique({
      where: { id: Number(line.productId) },
    });
    if (!product?.isActive) throw new ApiError(400, `Produit ${line.productId} indisponible`);
    const qty = Math.max(1, Number(line.quantity) || 1);
    const lineCost = product.couponPrice * qty;
    if (product.stock < qty) throw new ApiError(400, `Stock insuffisant (${product.name})`);
    totalCoupons += lineCost;
    lines.push({ product, qty, lineCost, unitCouponPrice: product.couponPrice });
  }

  if (participant.coupons < totalCoupons) {
    throw new ApiError(400, `Coupons insuffisants (solde ${participant.coupons}, nécessaire ${totalCoupons})`);
  }

  return prisma.$transaction(async (tx) => {
    for (const l of lines) {
      await tx.product.update({
        where: { id: l.product.id },
        data: { stock: { decrement: l.qty } },
      });
    }

    await tx.participant.update({
      where: { id: participantDbId },
      data: { coupons: { decrement: totalCoupons } },
    });

    const order = await tx.order.create({
      data: {
        participantId: participantDbId,
        totalCoupons,
        items: {
          create: lines.map((l) => ({
            productId: l.product.id,
            quantity: l.qty,
            unitCouponPrice: l.unitCouponPrice,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: {
              include: { brand: { select: { userId: true } } },
            },
          },
        },
      },
    });

    await tx.notification.create({
      data: {
        userId,
        type: "order_confirmed",
        message: `Commande #${order.id} créée (${totalCoupons} coupons).`,
      },
    });

    const brandLines = new Map();
    for (const item of order.items) {
      const uid = item.product.brand.userId;
      if (!brandLines.has(uid)) brandLines.set(uid, []);
      const spent = item.quantity * item.unitCouponPrice;
      brandLines.get(uid).push(`« ${item.product.name} » ×${item.quantity} (${spent} coupons)`);
    }
    for (const [brandUserId, lineMsgs] of brandLines.entries()) {
      await tx.notification.create({
        data: {
          userId: brandUserId,
          type: "order_created",
          message: `Nouvel achat — ${participant.user.name} (${participant.user.email}) — ${lineMsgs.join(" ; ")}.`,
        },
      });
    }

    return order;
  });
}

async function listOrders(participantDbId) {
  return prisma.order.findMany({
    where: { participantId: participantDbId },
    orderBy: { id: "desc" },
    include: {
      items: {
        include: {
          product: {
            include: {
              brand: { include: { user: { select: { name: true } } } },
            },
          },
        },
      },
    },
  });
}

async function getOrder(participantDbId, orderId) {
  const o = await prisma.order.findFirst({
    where: { id: Number(orderId), participantId: participantDbId },
    include: {
      items: {
        include: {
          product: {
            include: {
              brand: { include: { user: { select: { name: true } } } },
            },
          },
        },
      },
    },
  });
  if (!o) throw new ApiError(404, "Commande introuvable");
  return o;
}

module.exports = {
  listProducts,
  getProduct,
  placeOrder,
  listOrders,
  getOrder,
};
