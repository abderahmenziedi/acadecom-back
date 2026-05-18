const prisma = require("../prisma/client");

async function top20() {
  const participants = await prisma.participant.findMany({
    orderBy: { xp: "desc" },
    take: 20,
    include: {
      user: { select: { name: true, avatar: true } },
      xpRank: { select: { label: true, icon: true } },
    },
  });

  return participants.map((p, i) => ({
    rank: i + 1,
    name: p.user.name,
    avatar: p.user.avatar,
    xp: p.xp,
    xpRank: {
      label: p.xpRank.label,
      icon: p.xpRank.icon,
    },
  }));
}

module.exports = { top20 };
