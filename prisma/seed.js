/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

const ROUNDS = 10;

const XP_RANKS = [
  { label: "Débutant", minXp: 0, maxXp: 199, icon: "🌱" },
  { label: "Apprenti", minXp: 200, maxXp: 499, icon: "📘" },
  { label: "Confirmé", minXp: 500, maxXp: 999, icon: "⚡" },
  { label: "Expert", minXp: 1000, maxXp: 1999, icon: "🔥" },
  { label: "Maître", minXp: 2000, maxXp: 3999, icon: "💎" },
  { label: "Mythique", minXp: 4000, maxXp: 99999, icon: "👑" },
];

function buildQuestion(text, xpReward, correctIndex) {
  const opts = ["Option A", "Option B", "Option C", "Option D"].map((t, i) => ({
    text: t,
    isCorrect: i === correctIndex,
  }));
  return { text, xpReward, options: { create: opts } };
}

async function main() {
  await prisma.notification.deleteMany();
  await prisma.answer.deleteMany();
  await prisma.gameSession.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.option.deleteMany();
  await prisma.question.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.product.deleteMany();
  await prisma.quizmaster.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.participant.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.user.deleteMany();
  await prisma.xpRank.deleteMany();

  for (const r of XP_RANKS) {
    await prisma.xpRank.create({ data: r });
  }
  const ranks = await prisma.xpRank.findMany({ orderBy: { minXp: "asc" } });
  const rankIdForXp = (xp) => {
    const row = ranks.find((k) => xp >= k.minXp && xp <= k.maxXp);
    if (!row) return ranks[ranks.length - 1].id;
    return row.id;
  };

  const pass = await bcrypt.hash("password123", ROUNDS);

  const adminUser = await prisma.user.create({
    data: {
      email: "admin@acadecom.com",
      password: pass,
      name: "Administrateur",
      role: "admin",
      admin: { create: {} },
    },
  });
  console.log("Admin:", adminUser.email);

  const b1User = await prisma.user.create({
    data: {
      email: "ooredoo@brand.com",
      password: pass,
      name: "Ooredoo",
      role: "brand",
      brand: { create: { industry: "Telecom", description: "Ooredoo Tunisia" } },
    },
    include: { brand: true },
  });
  const b2User = await prisma.user.create({
    data: {
      email: "orange@brand.com",
      password: pass,
      name: "Orange",
      role: "brand",
      brand: { create: { industry: "Telecom", description: "Orange Tunisia" } },
    },
    include: { brand: true },
  });

  const brand1 = b1User.brand;
  const brand2 = b2User.brand;

  const qmDefs = [
    { name: "Amir", email: "amir@ooredoo.com", brandId: brand1.id },
    { name: "Sana", email: "sana@ooredoo.com", brandId: brand1.id },
    { name: "Mehdi", email: "mehdi@orange.com", brandId: brand2.id },
    { name: "Rania", email: "rania@orange.com", brandId: brand2.id },
  ];

  const quizmasters = [];
  for (const q of qmDefs) {
    const u = await prisma.user.create({
      data: {
        email: q.email,
        password: pass,
        name: q.name,
        role: "quizmaster",
        quizmaster: { create: { brandId: q.brandId, approvalStatus: "ACTIVE" } },
      },
      include: { quizmaster: true },
    });
    quizmasters.push(u.quizmaster);
  }

  const seedQmProfile = {
    phoneE164: "+21670111223",
    gender: "prefer_not",
    birthDate: new Date("1990-01-10"),
    profilePhotoUrl: "https://placehold.co/140x140/png?text=QM",
    isProfileComplete: true,
  };
  for (const qm of quizmasters) {
    await prisma.quizmaster.update({ where: { id: qm.id }, data: seedQmProfile });
  }

  const participantsData = [
    { name: "Alice", email: "alice@participant.com", xp: 350, coupons: 20 },
    { name: "Bob", email: "bob@participant.com", xp: 820, coupons: 5 },
    { name: "Sara", email: "sara@participant.com", xp: 50, coupons: 30 },
  ];
  for (const p of participantsData) {
    await prisma.user.create({
      data: {
        email: p.email,
        password: pass,
        name: p.name,
        role: "participant",
        participant: {
          create: {
            xp: p.xp,
            coupons: p.coupons,
            totalPoints: p.xp,
            xpRankId: rankIdForXp(p.xp),
          },
        },
      },
    });
  }

  const seedParticipantsProfile = {
    phoneE164: "+21670111222",
    gender: "prefer_not",
    birthDate: new Date("1999-05-20"),
    country: "Tunisia",
    city: "Tunis",
    profilePhotoUrl: "https://placehold.co/140x140/png?text=P",
    isProfileComplete: true,
  };
  for (const em of participantsData.map((x) => x.email)) {
    const uRow = await prisma.user.findUnique({ where: { email: em }, select: { id: true } });
    await prisma.participant.update({
      where: { userId: uRow.id },
      data: seedParticipantsProfile,
    });
  }

  await prisma.product.createMany({
    data: [
      {
        brandId: brand1.id,
        name: "Recharge 5DT",
        description: "Crédit téléphonique utilisable par votre ligne.",
        couponPrice: 10,
        stock: 50,
      },
      {
        brandId: brand1.id,
        name: "Recharge 10DT",
        description: "Pack recharge valeur 10 dinars.",
        couponPrice: 18,
        stock: 30,
      },
      {
        brandId: brand2.id,
        name: "Data Pack 1GB",
        description: "Internet mobile valable selon conditions opérateur.",
        couponPrice: 12,
        stock: 40,
      },
      {
        brandId: brand2.id,
        name: "Forfait Appel",
        description: "Minutes d’appels selon grille promotionnelle.",
        couponPrice: 15,
        stock: 25,
      },
    ],
  });

  let qc = 0;
  const xpRewards = [15, 18, 22, 28];
  for (const qm of quizmasters) {
    for (let n = 1; n <= 2; n += 1) {
      qc += 1;
      const maxCoupons = 10 + (qc % 11);
      const questions = [];
      for (let i = 0; i < 4; i += 1) {
        questions.push(
          buildQuestion(
            `Q${qc}-${i + 1}: Question pour ${qm.id} partie ${n}`,
            xpRewards[i],
            i % 4
          )
        );
      }
      await prisma.quiz.create({
        data: {
          brandId: qm.brandId,
          quizmasterId: qm.id,
          title: `Quiz ${n} · QM ${qm.id}`,
          category: qc % 2 === 0 ? "Général" : "Télécom",
          maxCoupons,
          isActive: true,
          durationSeconds: 300,
          passingScore: 0.6,
          questions: { create: questions },
        },
      });
    }
  }

  console.log("Seed OK — admin quizmasters quizzes products participants");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
