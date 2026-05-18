const { Parser } = require("json2csv");
const prisma = require("../prisma/client");
const ApiError = require("../utils/ApiError");

function assertTargetNotAdmin(user) {
  if (user && user.role === "admin") {
    throw new ApiError(403, "Action interdite : les administrateurs ne peuvent être bloqués, débloqués ni supprimés.");
  }
}

async function listUsers({ page = 1, limit = 20, role } = {}) {
  /** Les comptes admin ne sont jamais listés. */
  const where = {
    AND: [{ role: { not: "admin" } }, ...(role && role !== "admin" ? [{ role }] : [])],
  };
  const skip = (page - 1) * limit;
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { id: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isBlocked: true,
        avatar: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);
  return { users, total, page, pages: Math.ceil(total / limit) };
}

async function blockUser(actorId, targetId) {
  if (actorId === targetId) throw new ApiError(400, "Impossible");

  const payload = await prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id: targetId },
      include: { brand: true },
    });
    if (!target) throw new ApiError(404, "Utilisateur introuvable");
    assertTargetNotAdmin(target);

    await tx.user.update({ where: { id: targetId }, data: { isBlocked: true } });

    // Pas de profil Brand → pas de cascade (simple blocage du compte cible).
    if (!target.brand) {
      await tx.notification
        .create({
          data: {
            userId: targetId,
            type: "account_blocked",
            message: "Votre compte a été suspendu par l'administration.",
          },
        })
        .catch(() => {});
      return {
        message: "User blocked",
        blockedQuizmasters: 0,
        deactivatedQuizzes: 0,
      };
    }

    const quizmasters = await tx.quizmaster.findMany({
      where: { brandId: target.brand.id },
      select: { id: true, userId: true },
    });

    const qmIds = quizmasters.map((q) => q.id);
    const qmUserIds = quizmasters.map((q) => q.userId);
    const brandName = target.name;

    // Automatique : tous les quizmasters liés à la marque sont bloqués.
    if (qmUserIds.length) {
      await tx.user.updateMany({
        where: { id: { in: qmUserIds }, role: "quizmaster" },
        data: { isBlocked: true },
      });
    }

    let deactivatedQuizzes = 0;
    if (qmIds.length) {
      const rz = await tx.quiz.updateMany({
        where: { quizmasterId: { in: qmIds } },
        data: { isActive: false },
      });
      deactivatedQuizzes = rz.count;
    }

    if (quizmasters.length) {
      await tx.notification.createMany({
        data: quizmasters.map((qm) => ({
          userId: qm.userId,
          type: "account_blocked",
          message:
            `Votre compte a été suspendu suite à la suspension de la marque ${brandName}.`,
        })),
      });
    }

    await tx.notification
      .create({
        data: {
          userId: target.id,
          type: "account_blocked",
          message: `Votre compte marque a été suspendu par l'administration.`,
        },
      })
      .catch(() => {});

    return {
      message: "Brand blocked",
      blockedQuizmasters: quizmasters.length,
      deactivatedQuizzes,
    };
  });

  return payload;
}

async function unblockUser(actorId, targetId) {
  if (actorId === targetId) throw new ApiError(400, "Impossible");

  const payload = await prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id: targetId },
      include: { brand: true },
    });
    if (!target) throw new ApiError(404, "Utilisateur introuvable");
    assertTargetNotAdmin(target);

    await tx.user.update({ where: { id: targetId }, data: { isBlocked: false } });

    // Pas de profil Brand → pas de cascade.
    if (!target.brand) {
      return {
        message: "User unblocked",
        unblockedQuizmasters: 0,
      };
    }

    const quizmasters = await tx.quizmaster.findMany({
      where: { brandId: target.brand.id },
      select: { userId: true },
    });
    const qmUserIds = quizmasters.map((q) => q.userId);
    const brandName = target.name;

    // Automatique : tous les quizmasters de la marque redeviennent débloqués (sans réactiver les quiz).
    if (qmUserIds.length) {
      await tx.user.updateMany({
        where: { id: { in: qmUserIds }, role: "quizmaster" },
        data: { isBlocked: false },
      });
    }

    if (quizmasters.length) {
      await tx.notification.createMany({
        data: quizmasters.map((qm) => ({
          userId: qm.userId,
          type: "account_unblocked",
          message:
            `Votre compte a été réactivé suite à la réactivation de la marque ${brandName}.`,
        })),
      });
    }

    return {
      message: "Brand unblocked",
      unblockedQuizmasters: quizmasters.length,
    };
  });

  return payload;
}

async function deleteUser(actorId, targetId) {
  if (actorId === targetId) throw new ApiError(400, "Impossible");
  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) throw new ApiError(404, "Utilisateur introuvable");
  assertTargetNotAdmin(target);
  await prisma.user.delete({ where: { id: targetId } });
}

async function exportCsv() {
  const users = await prisma.user.findMany({
    where: { role: { not: "admin" } },
    orderBy: { id: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isBlocked: true,
      createdAt: true,
    },
  });
  const parser = new Parser();
  return parser.parse(users);
}

module.exports = { listUsers, blockUser, unblockUser, deleteUser, exportCsv };
