/* eslint-disable no-console */
/**
 * Seed léger — démo PFE (mot de passe commun : password123)
 */
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const { normalizeOptionsPayload } = require(path.join(__dirname, "..", "src", "utils", "questionOptionsJson"));

const prisma = new PrismaClient();

const XP_RANKS = [
  { label: "Débutant", minXp: 0, maxXp: 199, icon: "🌱" },
  { label: "Apprenti", minXp: 200, maxXp: 499, icon: "📘" },
  { label: "Confirmé", minXp: 500, maxXp: 999, icon: "⚡" },
  { label: "Expert", minXp: 1000, maxXp: 99999, icon: "🔥" },
];

function mcq(text, correctIndex = 0) {
  const labels = ["Réponse A", "Réponse B", "Réponse C"];
  const opts = labels.map((t, i) => ({ text: t, isCorrect: i === correctIndex }));
  return { text, xpReward: 10, options: normalizeOptionsPayload(opts) };
}

async function wipe() {
  await prisma.notification.deleteMany();
  await prisma.quizAttempt.deleteMany();
  await prisma.order.deleteMany();
  await prisma.question.deleteMany();
  await prisma.preQuestion.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.product.deleteMany();
  await prisma.quizmaster.deleteMany();
  await prisma.brandSubscriptionCycle.deleteMany();
  await prisma.participant.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.user.deleteMany();
  await prisma.xpRank.deleteMany();
}

async function main() {
  await wipe();

  for (const r of XP_RANKS) {
    await prisma.xpRank.create({ data: r });
  }
  const ranks = await prisma.xpRank.findMany({ orderBy: { minXp: "asc" } });
  const rankIdForXp = (xp) => {
    const row = ranks.find((k) => xp >= k.minXp && xp <= k.maxXp);
    return row ? row.id : ranks[ranks.length - 1].id;
  };

  const pass = await bcrypt.hash("password123", 10);

  await prisma.user.create({
    data: {
      email: "admin@acadecom.com",
      password: pass,
      name: "Administrateur",
      role: "admin",
      admin: { create: {} },
    },
  });

  const brands = [
    { email: "ooredoo@brand.com", name: "Ooredoo Tunisia", qmEmail: "amir@ooredoo.com", qmName: "Amir" },
    { email: "orange@brand.com", name: "Orange Tunisia", qmEmail: "mehdi@orange.com", qmName: "Mehdi" },
  ];

  const participants = [
    { email: "alice@participant.com", name: "Alice", xp: 120, coupons: 25 },
    { email: "bob@participant.com", name: "Bob", xp: 450, coupons: 8 },
    { email: "sara@participant.com", name: "Sara", xp: 80, coupons: 15 },
  ];

  const qmProfile = {
    phoneE164: "+21670111223",
    gender: "prefer_not",
    birthDate: new Date("1990-01-10"),
    profilePhotoUrl: "https://placehold.co/140x140/png?text=QM",
    isProfileComplete: true,
    approvalStatus: "ACTIVE",
  };

  const participantProfile = {
    phoneE164: "+21670111222",
    gender: "prefer_not",
    birthDate: new Date("1999-05-20"),
    country: "Tunisia",
    city: "Tunis",
    profilePhotoUrl: "https://placehold.co/140x140/png?text=P",
    isProfileComplete: true,
  };

  for (const b of brands) {
    const brandUser = await prisma.user.create({
      data: {
        email: b.email,
        password: pass,
        name: b.name,
        role: "brand",
        brand: {
          create: {
            industry: "Telecom",
            description: b.name,
            planType: "FREE",
            subscriptionStatus: "ACTIVE",
          },
        },
      },
      include: { brand: true },
    });

    const qmUser = await prisma.user.create({
      data: {
        email: b.qmEmail,
        password: pass,
        name: b.qmName,
        role: "quizmaster",
        quizmaster: { create: { brandId: brandUser.brand.id, ...qmProfile } },
      },
      include: { quizmaster: true },
    });

    await prisma.product.create({
      data: {
        brandId: brandUser.brand.id,
        name: b.email.startsWith("ooredoo") ? "Recharge 5DT" : "Data Pack 1GB",
        description: "Produit démo boutique coupons.",
        couponPrice: 10,
        stock: 50,
        isActive: true,
      },
    });

    await prisma.quiz.create({
      data: {
        brandId: brandUser.brand.id,
        quizmasterId: qmUser.quizmaster.id,
        title: `Quiz télécom — ${b.name}`,
        category: "Telecom",
        maxCoupons: 10,
        isActive: true,
        durationSeconds: 300,
        passingScore: 0.5,
        questions: {
          create: [
            mcq("Que signifie 4G ?", 0),
            mcq("Un forfait prépayé permet de…", 0),
            mcq("Le Mbps mesure…", 0),
          ],
        },
      },
    });
  }

  for (const p of participants) {
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
            ...participantProfile,
          },
        },
      },
    });
  }

  console.log("Seed OK — 1 admin, 2 marques, 2 quizmasters, 2 quiz, 2 produits, 3 participants (password123)");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
