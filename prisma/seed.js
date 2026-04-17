const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database v2.0...\n");

  // Clear existing data (order matters for FK constraints)
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.userBadge.deleteMany();
  await prisma.badge.deleteMany();
  await prisma.product.deleteMany();
  await prisma.answer.deleteMany();
  await prisma.pointsHistory.deleteMany();
  await prisma.attempt.deleteMany();
  await prisma.option.deleteMany();
  await prisma.question.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.user.deleteMany();

  console.log("✅  Cleared existing data");

  const password = await bcrypt.hash("password123", 10);

  // ═══════════════════════════════════════════════════════════
  // 1. USERS
  // ═══════════════════════════════════════════════════════════

  const admin = await prisma.user.create({
    data: {
      name: "Admin Principal",
      email: "admin@acadecom.com",
      password,
      role: "admin",
    },
  });
  console.log(`👑  Admin: ${admin.email}`);

  const brand = await prisma.user.create({
    data: {
      name: "TechCorp",
      email: "brand@acadecom.com",
      password,
      role: "brand",
      industry: "Technologie",
      description: "Entreprise leader en solutions technologiques innovantes.",
    },
  });

  const brand2 = await prisma.user.create({
    data: {
      name: "EduLearn",
      email: "brand2@acadecom.com",
      password,
      role: "brand",
      industry: "Éducation",
      description: "Plateforme éducative de nouvelle génération.",
    },
  });
  console.log(`🏢  Brands: ${brand.name}, ${brand2.name}`);

  const quizmaster = await prisma.user.create({
    data: {
      name: "Jean Quiz",
      email: "quizmaster@acadecom.com",
      password,
      role: "quizmaster",
      brandId: brand.id,
    },
  });

  const quizmaster2 = await prisma.user.create({
    data: {
      name: "Sophie Master",
      email: "quizmaster2@acadecom.com",
      password,
      role: "quizmaster",
      brandId: brand2.id,
    },
  });
  console.log(`👨‍🏫  Quizmasters: ${quizmaster.name}, ${quizmaster2.name}`);

  const participant = await prisma.user.create({
    data: {
      name: "Marie Participante",
      email: "participant@acadecom.com",
      password,
      role: "participant",
      totalPoints: 45,
      xp: 120,
      level: 2,
      coupons: 3,
    },
  });

  const participant2 = await prisma.user.create({
    data: {
      name: "Alex Joueur",
      email: "participant2@acadecom.com",
      password,
      role: "participant",
      totalPoints: 78,
      xp: 250,
      level: 3,
      coupons: 5,
    },
  });

  const participant3 = await prisma.user.create({
    data: {
      name: "Lucas Champion",
      email: "participant3@acadecom.com",
      password,
      role: "participant",
      totalPoints: 120,
      xp: 500,
      level: 5,
      coupons: 8,
    },
  });
  console.log(`🎮  Participants: ${participant.name}, ${participant2.name}, ${participant3.name}`);

  // ═══════════════════════════════════════════════════════════
  // 2. QUIZZES
  // ═══════════════════════════════════════════════════════════

  const quiz1 = await prisma.quiz.create({
    data: {
      title: "Culture Générale Tech",
      description: "Testez vos connaissances en technologie et informatique !",
      brandId: brand.id,
      quizmasterId: quizmaster.id,
      timeLimit: 300,
      pointsPerQuestion: 2,
      shuffleQuestions: false,
      isActive: true,
      difficulty: "easy",
      xpReward: 15,
      couponReward: 1,
      passingScore: 60,
      category: "Technologie",
      questions: {
        create: [
          {
            text: "Quel langage de programmation est principalement utilisé pour le développement web frontend ?",
            points: 2, order: 1, difficulty: "easy",
            options: { create: [
              { text: "Python", isCorrect: false },
              { text: "JavaScript", isCorrect: true },
              { text: "Java", isCorrect: false },
              { text: "C++", isCorrect: false },
            ]},
          },
          {
            text: "Que signifie HTML ?",
            points: 2, order: 2, difficulty: "easy",
            options: { create: [
              { text: "Hyper Text Markup Language", isCorrect: true },
              { text: "High Tech Modern Language", isCorrect: false },
              { text: "Hyper Transfer Markup Language", isCorrect: false },
              { text: "Home Tool Markup Language", isCorrect: false },
            ]},
          },
          {
            text: "Quel est le système de gestion de versions le plus populaire ?",
            points: 2, order: 3, difficulty: "easy",
            options: { create: [
              { text: "SVN", isCorrect: false },
              { text: "Mercurial", isCorrect: false },
              { text: "Git", isCorrect: true },
              { text: "CVS", isCorrect: false },
            ]},
          },
          {
            text: "Quelle base de données est de type NoSQL ?",
            points: 2, order: 4, difficulty: "medium",
            options: { create: [
              { text: "MySQL", isCorrect: false },
              { text: "PostgreSQL", isCorrect: false },
              { text: "MongoDB", isCorrect: true },
              { text: "Oracle", isCorrect: false },
            ]},
          },
          {
            text: "Que signifie API ?",
            points: 2, order: 5, difficulty: "easy",
            options: { create: [
              { text: "Application Programming Interface", isCorrect: true },
              { text: "Advanced Program Integration", isCorrect: false },
              { text: "Automated Process Interface", isCorrect: false },
              { text: "Application Process Integration", isCorrect: false },
            ]},
          },
        ],
      },
    },
  });

  const quiz2 = await prisma.quiz.create({
    data: {
      title: "Cybersécurité Basics",
      description: "Les fondamentaux de la sécurité informatique.",
      brandId: brand.id,
      quizmasterId: quizmaster.id,
      timeLimit: 180,
      pointsPerQuestion: 3,
      shuffleQuestions: true,
      isActive: true,
      difficulty: "medium",
      xpReward: 25,
      couponReward: 2,
      passingScore: 50,
      category: "Sécurité",
      questions: {
        create: [
          {
            text: "Quel protocole sécurise les communications web ?",
            points: 3, order: 1, difficulty: "easy",
            options: { create: [
              { text: "HTTP", isCorrect: false },
              { text: "HTTPS", isCorrect: true },
              { text: "FTP", isCorrect: false },
              { text: "SMTP", isCorrect: false },
            ]},
          },
          {
            text: "Qu'est-ce qu'un pare-feu (firewall) ?",
            points: 3, order: 2, difficulty: "medium",
            options: { create: [
              { text: "Un antivirus", isCorrect: false },
              { text: "Un système qui filtre le trafic réseau", isCorrect: true },
              { text: "Un protocole de chiffrement", isCorrect: false },
              { text: "Un type de malware", isCorrect: false },
            ]},
          },
          {
            text: "Quelle attaque consiste à envoyer des emails frauduleux ?",
            points: 3, order: 3, difficulty: "medium",
            options: { create: [
              { text: "DDoS", isCorrect: false },
              { text: "SQL Injection", isCorrect: false },
              { text: "Phishing", isCorrect: true },
              { text: "Brute Force", isCorrect: false },
            ]},
          },
        ],
      },
    },
  });

  const quiz3 = await prisma.quiz.create({
    data: {
      title: "Intelligence Artificielle Avancée",
      description: "Maîtrisez-vous les concepts avancés de l'IA ?",
      brandId: brand2.id,
      quizmasterId: quizmaster2.id,
      timeLimit: 600,
      pointsPerQuestion: 5,
      shuffleQuestions: true,
      isActive: true,
      difficulty: "hard",
      xpReward: 50,
      couponReward: 3,
      passingScore: 40,
      category: "Intelligence Artificielle",
      questions: {
        create: [
          {
            text: "Quel algorithme est utilisé pour l'apprentissage profond ?",
            points: 5, order: 1, difficulty: "hard",
            hint: "Pensez aux couches de neurones",
            options: { create: [
              { text: "Régression linéaire", isCorrect: false },
              { text: "Réseau de neurones profond (DNN)", isCorrect: true },
              { text: "Arbre de décision", isCorrect: false },
              { text: "K-Means", isCorrect: false },
            ]},
          },
          {
            text: "Qu'est-ce que le transfer learning ?",
            points: 5, order: 2, difficulty: "hard",
            options: { create: [
              { text: "Entraîner un modèle de zéro", isCorrect: false },
              { text: "Réutiliser un modèle pré-entraîné pour une nouvelle tâche", isCorrect: true },
              { text: "Transférer des données entre serveurs", isCorrect: false },
              { text: "Copier l'architecture d'un réseau", isCorrect: false },
            ]},
          },
          {
            text: "Quel est le rôle de la fonction d'activation dans un réseau de neurones ?",
            points: 5, order: 3, difficulty: "hard",
            options: { create: [
              { text: "Stocker les poids", isCorrect: false },
              { text: "Introduire de la non-linéarité", isCorrect: true },
              { text: "Réduire la dimension", isCorrect: false },
              { text: "Normaliser les entrées", isCorrect: false },
            ]},
          },
          {
            text: "Que signifie NLP ?",
            points: 5, order: 4, difficulty: "medium",
            options: { create: [
              { text: "Natural Language Processing", isCorrect: true },
              { text: "Neural Learning Protocol", isCorrect: false },
              { text: "Network Layer Processing", isCorrect: false },
              { text: "Node Learning Platform", isCorrect: false },
            ]},
          },
        ],
      },
    },
  });

  console.log(`📝  Quizzes: "${quiz1.title}", "${quiz2.title}", "${quiz3.title}"`);

  // ═══════════════════════════════════════════════════════════
  // 3. BADGES
  // ═══════════════════════════════════════════════════════════

  const badges = await Promise.all([
    prisma.badge.create({
      data: { name: "Premier Quiz", description: "Complétez votre premier quiz", icon: "🎯", condition: "quizzes_completed:1", xpReward: 10 },
    }),
    prisma.badge.create({
      data: { name: "Quizzeur Assidu", description: "Complétez 5 quiz", icon: "🔥", condition: "quizzes_completed:5", xpReward: 25 },
    }),
    prisma.badge.create({
      data: { name: "Score Parfait", description: "Obtenez 100% sur un quiz", icon: "💎", condition: "perfect_score:1", xpReward: 50 },
    }),
    prisma.badge.create({
      data: { name: "Première Commande", description: "Effectuez votre premier achat", icon: "🛒", condition: "orders_completed:1", xpReward: 15 },
    }),
    prisma.badge.create({
      data: { name: "Expert", description: "Atteignez le niveau 5", icon: "⭐", condition: "level_reached:5", xpReward: 100 },
    }),
    prisma.badge.create({
      data: { name: "Maître du Temps", description: "Complétez un quiz en moins de 60s", icon: "⚡", condition: "speed_completion:60", xpReward: 30 },
    }),
    prisma.badge.create({
      data: { name: "Série de Victoires", description: "Réussissez 3 quiz consécutifs", icon: "🏆", condition: "win_streak:3", xpReward: 40 },
    }),
    prisma.badge.create({
      data: { name: "Collectionneur", description: "Gagnez 100 points au total", icon: "💰", condition: "total_points:100", xpReward: 20 },
    }),
  ]);
  console.log(`🏅  ${badges.length} badges created`);

  // Assign badges
  await prisma.userBadge.createMany({
    data: [
      { userId: participant.id, badgeId: badges[0].id },
      { userId: participant2.id, badgeId: badges[0].id },
      { userId: participant2.id, badgeId: badges[1].id },
      { userId: participant3.id, badgeId: badges[0].id },
      { userId: participant3.id, badgeId: badges[1].id },
      { userId: participant3.id, badgeId: badges[2].id },
      { userId: participant3.id, badgeId: badges[4].id },
      { userId: participant3.id, badgeId: badges[7].id },
    ],
  });

  // ═══════════════════════════════════════════════════════════
  // 4. PRODUCTS
  // ═══════════════════════════════════════════════════════════

  const products = await Promise.all([
    prisma.product.create({
      data: { brandId: brand.id, title: "T-Shirt TechCorp", description: "T-shirt exclusif avec le logo TechCorp.", price: 10, stock: 50, category: "Vêtements", imageUrl: "https://placehold.co/400x400/6c3fc5/white?text=T-Shirt" },
    }),
    prisma.product.create({
      data: { brandId: brand.id, title: "Stickers Pack Tech", description: "Pack de 10 stickers développeur.", price: 3, stock: 200, category: "Accessoires", imageUrl: "https://placehold.co/400x400/10b981/white?text=Stickers" },
    }),
    prisma.product.create({
      data: { brandId: brand.id, title: "Mug Développeur", description: "Mug 'I ❤️ Code' — idéal pour le café.", price: 5, stock: 100, category: "Accessoires", imageUrl: "https://placehold.co/400x400/f59e0b/white?text=Mug" },
    }),
    prisma.product.create({
      data: { brandId: brand2.id, title: "Cours Premium IA", description: "10h de cours vidéo sur l'Intelligence Artificielle.", price: 15, stock: 30, category: "Formation", imageUrl: "https://placehold.co/400x400/06b6d4/white?text=Cours+IA" },
    }),
    prisma.product.create({
      data: { brandId: brand2.id, title: "E-Book Data Science", description: "Guide complet Data Science.", price: 8, stock: 999, category: "Formation", imageUrl: "https://placehold.co/400x400/8b5cf6/white?text=E-Book" },
    }),
  ]);
  console.log(`🛍️  ${products.length} products created`);

  // ═══════════════════════════════════════════════════════════
  // 5. ATTEMPTS & POINTS
  // ═══════════════════════════════════════════════════════════

  const attempt1 = await prisma.attempt.create({
    data: { quizId: quiz1.id, userId: participant3.id, score: 10, maxScore: 10, completedAt: new Date("2026-04-10"), duration: 120, passed: true, xpEarned: 15, couponsEarned: 1 },
  });
  const attempt2 = await prisma.attempt.create({
    data: { quizId: quiz2.id, userId: participant3.id, score: 6, maxScore: 9, completedAt: new Date("2026-04-12"), duration: 95, passed: true, xpEarned: 25, couponsEarned: 2 },
  });
  const attempt3 = await prisma.attempt.create({
    data: { quizId: quiz1.id, userId: participant2.id, score: 8, maxScore: 10, completedAt: new Date("2026-04-11"), duration: 180, passed: true, xpEarned: 15, couponsEarned: 1 },
  });

  await prisma.pointsHistory.createMany({
    data: [
      { userId: participant3.id, points: 10, reason: "Quiz terminé : Culture Générale Tech", attemptId: attempt1.id },
      { userId: participant3.id, points: 6, reason: "Quiz terminé : Cybersécurité Basics", attemptId: attempt2.id },
      { userId: participant3.id, points: -5, reason: "Achat : Stickers Pack Tech" },
      { userId: participant2.id, points: 8, reason: "Quiz terminé : Culture Générale Tech", attemptId: attempt3.id },
      { userId: participant.id, points: 5, reason: "Bonus d'inscription" },
    ],
  });
  console.log("📊  Attempts and points history created");

  // ═══════════════════════════════════════════════════════════
  // 6. ORDERS
  // ═══════════════════════════════════════════════════════════

  await prisma.order.create({
    data: {
      userId: participant3.id, totalPrice: 3, status: "confirmed",
      items: { create: [{ productId: products[1].id, quantity: 1, price: 3 }] },
    },
  });
  console.log("📦  Sample order created");

  // ═══════════════════════════════════════════════════════════
  // 7. NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════

  await prisma.notification.createMany({
    data: [
      { userId: participant.id, type: "system", title: "Bienvenue !", message: "Bienvenue sur AcadeCom ! Jouez à un quiz pour gagner vos premiers points." },
      { userId: participant2.id, type: "badge_earned", title: "Badge débloqué !", message: "Vous avez obtenu le badge 'Quizzeur Assidu' ! +25 XP" },
      { userId: participant3.id, type: "level_up", title: "Niveau supérieur !", message: "Félicitations ! Vous êtes niveau 5 — Expert !", isRead: true },
      { userId: participant3.id, type: "order_confirmed", title: "Commande confirmée", message: "Votre commande de Stickers Pack Tech a été confirmée.", isRead: true },
    ],
  });
  console.log("🔔  Notifications created");

  console.log("\n🎉 Seed completed successfully!");
  console.log("────────────────────────────────────");
  console.log("Test credentials (password: password123):");
  console.log("  Admin:         admin@acadecom.com");
  console.log("  Brand 1:       brand@acadecom.com");
  console.log("  Brand 2:       brand2@acadecom.com");
  console.log("  Quizmaster 1:  quizmaster@acadecom.com");
  console.log("  Quizmaster 2:  quizmaster2@acadecom.com");
  console.log("  Participant 1: participant@acadecom.com");
  console.log("  Participant 2: participant2@acadecom.com");
  console.log("  Participant 3: participant3@acadecom.com");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
