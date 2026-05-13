const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database v3.0 - Production Ready...\n");

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
  // 1. ADMIN
  // ═══════════════════════════════════════════════════════════

  const admin = await prisma.user.create({
    data: {
      name: "Administrateur",
      email: "admin@acadecom.com",
      password,
      role: "admin",
    },
  });
  console.log(`👑  Admin: ${admin.email}`);

  // ═══════════════════════════════════════════════════════════
  // 2. BRANDS - Les 6 marques requises
  // ═══════════════════════════════════════════════════════════

  const brandsData = [
    {
      name: "Ooredoo",
      email: "ooredoo@brand.com",
      industry: "Télécommunications",
      description: "Opérateur de télécommunications leader en Tunisie et dans la région MENA."
    },
    {
      name: "Orange",
      email: "orange@brand.com",
      industry: "Télécommunications",
      description: "Opérateur télécom global présent en Tunisie avec des services innovants."
    },
    {
      name: "Telecom",
      email: "telecom@brand.com",
      industry: "Télécommunications",
      description: "Tunisie Telecom - Premier opérateur historique des télécommunications en Tunisie."
    },
    {
      name: "Taraji Mobile",
      email: "taraji@brand.com",
      industry: "Sport / Télécommunications",
      description: "Opérateur mobile partenaire de l'Espérance Sportive de Tunis."
    },
    {
      name: "CA Mobile",
      email: "camobile@brand.com",
      industry: "Banque / Mobile",
      description: "Service mobile du Crédit Agricole Tunisie - Solutions bancaires mobiles."
    },
    {
      name: "CSS Mobile",
      email: "cssmobile@brand.com",
      industry: "Sport / Télécommunications",
      description: "Opérateur mobile partenaire du Club Sportif Sfaxien."
    },
  ];

  const brands = [];
  for (const brandData of brandsData) {
    const brand = await prisma.user.create({
      data: {
        name: brandData.name,
        email: brandData.email,
        password,
        role: "brand",
        industry: brandData.industry,
        description: brandData.description,
      },
    });
    brands.push(brand);
  }
  console.log(`�  ${brands.length} Brands créées: ${brands.map(b => b.name).join(", ")}`);

  // ═══════════════════════════════════════════════════════════
  // 3. QUIZMASTERS - 2 quizmasters par brand
  // ═══════════════════════════════════════════════════════════

  const quizmastersData = [
    { name: "Amir Ooredoo", email: "amir@ooredoo.com", brandIndex: 0 },
    { name: "Sami Ooredoo", email: "sami@ooredoo.com", brandIndex: 0 },
    { name: "Luc Orange", email: "luc@orange.com", brandIndex: 1 },
    { name: "Emma Orange", email: "emma@orange.com", brandIndex: 1 },
    { name: "Karim Telecom", email: "karim@telecom.com", brandIndex: 2 },
    { name: "Nadia Telecom", email: "nadia@telecom.com", brandIndex: 2 },
    { name: "Hassen Taraji", email: "hassen@taraji.com", brandIndex: 3 },
    { name: "Amina Taraji", email: "amina@taraji.com", brandIndex: 3 },
    { name: "Mohamed CA", email: "mohamed@ca.com", brandIndex: 4 },
    { name: "Fatima CA", email: "fatima@ca.com", brandIndex: 4 },
    { name: "Ali CSS", email: "ali@css.com", brandIndex: 5 },
    { name: "Lina CSS", email: "lina@css.com", brandIndex: 5 },
  ];

  const quizmasters = [];
  for (const qmData of quizmastersData) {
    const qm = await prisma.user.create({
      data: {
        name: qmData.name,
        email: qmData.email,
        password,
        role: "quizmaster",
        brandId: brands[qmData.brandIndex].id,
      },
    });
    quizmasters.push(qm);
  }
  console.log(`👨‍�  ${quizmasters.length} Quizmasters créés`);

  // ═══════════════════════════════════════════════════════════
  // 4. PARTICIPANTS
  // ═══════════════════════════════════════════════════════════

  const participantsData = [
    { name: "Ahmed Ben Ali", email: "ahmed@participant.com", points: 45, xp: 120, level: 2, coupons: 3 },
    { name: "Sara Trabelsi", email: "sara@participant.com", points: 78, xp: 250, level: 3, coupons: 5 },
    { name: "Mohamed Karoui", email: "mohamed@participant.com", points: 120, xp: 500, level: 5, coupons: 8 },
    { name: "Leila Bouaziz", email: "leila@participant.com", points: 35, xp: 80, level: 1, coupons: 2 },
    { name: "Youssef Gafsi", email: "youssef@participant.com", points: 95, xp: 350, level: 4, coupons: 6 },
    { name: "Nadia Mejri", email: "nadia@participant.com", points: 60, xp: 180, level: 2, coupons: 4 },
  ];

  const participants = [];
  for (const pData of participantsData) {
    const p = await prisma.user.create({
      data: {
        name: pData.name,
        email: pData.email,
        password,
        role: "participant",
        totalPoints: pData.points,
        xp: pData.xp,
        level: pData.level,
        coupons: pData.coupons,
      },
    });
    participants.push(p);
  }
  console.log(`🎮  ${participants.length} Participants créés`);

  // ═══════════════════════════════════════════════════════════
  // 5. QUIZZES - 2 quizzes actifs par brand
  // ═══════════════════════════════════════════════════════════

  const quizTemplates = [
    // Ooredoo - Quiz 1
    {
      brandIndex: 0, qmIndex: 0,
      title: "Ooredoo Telecom Quiz",
      description: "Testez vos connaissances sur les services Ooredoo et la technologie 4G/5G !",
      category: "Télécommunications",
      questions: [
        { text: "Quelle technologie permet les débits les plus élevés en mobile ?", points: 2, options: [{text: "3G", correct: false}, {text: "4G LTE", correct: false}, {text: "5G", correct: true}, {text: "EDGE", correct: false}] },
        { text: "Que signifie LTE ?", points: 2, options: [{text: "Long Term Evolution", correct: true}, {text: "Low Transfer Energy", correct: false}, {text: "Local Telecom Exchange", correct: false}, {text: "Light Transmission Ethernet", correct: false}] },
        { text: "Quel service permet d'appeler via Internet ?", points: 2, options: [{text: "VoLTE", correct: true}, {text: "SMS", correct: false}, {text: "MMS", correct: false}, {text: "USSD", correct: false}] },
      ]
    },
    // Ooredoo - Quiz 2
    {
      brandIndex: 0, qmIndex: 1,
      title: "Ooredoo Digital Services",
      description: "Découvrez les services digitaux et applications mobiles Ooredoo.",
      category: "Services Digitaux",
      questions: [
        { text: "Quelle application permet de gérer son forfait mobile ?", points: 2, options: [{text: "My Ooredoo", correct: true}, {text: "WhatsApp", correct: false}, {text: "Facebook", correct: false}, {text: "Instagram", correct: false}] },
        { text: "Quel service permet le paiement mobile ?", points: 3, options: [{text: "Ooredoo Money", correct: true}, {text: "PayPal", correct: false}, {text: "Stripe", correct: false}, {text: "Bitcoin", correct: false}] },
        { text: "Quelle vitesse théorique offre la 5G ?", points: 3, options: [{text: "10 Mbps", correct: false}, {text: "100 Mbps", correct: false}, {text: "1-10 Gbps", correct: true}, {text: "50 Kbps", correct: false}] },
      ]
    },
    // Orange - Quiz 1
    {
      brandIndex: 1, qmIndex: 2,
      title: "Orange Réseaux & Fibre",
      description: "Testez vos connaissances sur la fibre optique et les réseaux Orange.",
      category: "Infrastructure",
      questions: [
        { text: "Quel matériau compose les câbles à fibre optique ?", points: 2, options: [{text: "Cuivre", correct: false}, {text: "Verre ou plastique", correct: true}, {text: "Aluminium", correct: false}, {text: "Acier", correct: false}] },
        { text: "Quelle technologie utilise la fibre optique ?", points: 2, options: [{text: "Ondes radio", correct: false}, {text: "Signaux électriques", correct: false}, {text: "Lumière", correct: true}, {text: "Ultrasons", correct: false}] },
        { text: "Quel débit la fibre peut-elle atteindre ?", points: 3, options: [{text: "10 Mbps", correct: false}, {text: "100 Mbps", correct: false}, {text: "1-10 Gbps", correct: true}, {text: "1 Mbps", correct: false}] },
      ]
    },
    // Orange - Quiz 2
    {
      brandIndex: 1, qmIndex: 3,
      title: "Orange Entertainment",
      description: "Les services de divertissement et streaming d'Orange.",
      category: "Entertainment",
      questions: [
        { text: "Quelle plateforme de streaming propose Orange ?", points: 2, options: [{text: "Orange TV", correct: true}, {text: "Netflix", correct: false}, {text: "Amazon", correct: false}, {text: "Hulu", correct: false}] },
        { text: "Quel service de musique est partenaire Orange ?", points: 2, options: [{text: "Spotify", correct: true}, {text: "Apple Music", correct: false}, {text: "Deezer", correct: false}, {text: "Tidal", correct: false}] },
        { text: "Quelle application pour la TV sur mobile ?", points: 3, options: [{text: "My Orange", correct: false}, {text: "Orange TV Go", correct: true}, {text: "YouTube", correct: false}, {text: "VLC", correct: false}] },
      ]
    },
    // Telecom - Quiz 1
    {
      brandIndex: 2, qmIndex: 4,
      title: "Tunisie Telecom Histoire",
      description: "L'histoire et l'évolution de Tunisie Telecom depuis sa création.",
      category: "Histoire",
      questions: [
        { text: "En quelle année a été créée Tunisie Telecom ?", points: 2, options: [{text: "1956", correct: false}, {text: "1995", correct: true}, {text: "2000", correct: false}, {text: "2010", correct: false}] },
        { text: "Quel était l'ancien nom de TT ?", points: 2, options: [{text: "Office des Postes", correct: true}, {text: "France Telecom", correct: false}, {text: "AT&T", correct: false}, {text: "British Telecom", correct: false}] },
        { text: "Quelle technologie a été lancée en premier en Tunisie ?", points: 3, options: [{text: "Internet", correct: false}, {text: "Téléphonie fixe", correct: true}, {text: "5G", correct: false}, {text: "WiFi", correct: false}] },
      ]
    },
    // Telecom - Quiz 2
    {
      brandIndex: 2, qmIndex: 5,
      title: "Tunisie Telecom Innovation",
      description: "Les innovations et services modernes de Tunisie Telecom.",
      category: "Innovation",
      questions: [
        { text: "Quel service cloud propose TT ?", points: 2, options: [{text: "TT Cloud", correct: true}, {text: "AWS", correct: false}, {text: "Azure", correct: false}, {text: "Google Cloud", correct: false}] },
        { text: "Quelle est la vitesse max de la fibre TT ?", points: 3, options: [{text: "10 Mbps", correct: false}, {text: "100 Mbps", correct: false}, {text: "1 Gbps", correct: true}, {text: "50 Mbps", correct: false}] },
        { text: "Quel service de sécurité offre TT ?", points: 2, options: [{text: "Antivirus", correct: true}, {text: "VPN", correct: false}, {text: "Firewall", correct: false}, {text: "Proxy", correct: false}] },
      ]
    },
    // Taraji Mobile - Quiz 1
    {
      brandIndex: 3, qmIndex: 6,
      title: "Taraji Mobile & Football",
      description: "Le monde du football et l'Espérance Sportive de Tunis.",
      category: "Sport",
      questions: [
        { text: "En quelle année a été fondée l'EST ?", points: 2, options: [{text: "1919", correct: true}, {text: "1920", correct: false}, {text: "1956", correct: false}, {text: "2000", correct: false}] },
        { text: "Combien de Ligue des Champions a remporté l'EST ?", points: 3, options: [{text: "1", correct: false}, {text: "4", correct: true}, {text: "2", correct: false}, {text: "6", correct: false}] },
        { text: "Quelle est la couleur principale de l'EST ?", points: 1, options: [{text: "Rouge", correct: false}, {text: "Noir", correct: false}, {text: "Rouge et Noir", correct: true}, {text: "Blanc", correct: false}] },
      ]
    },
    // Taraji Mobile - Quiz 2
    {
      brandIndex: 3, qmIndex: 7,
      title: "Taraji Mobile Services",
      description: "Les services mobiles et offres spéciales Taraji Mobile.",
      category: "Services Mobiles",
      questions: [
        { text: "Quel type de forfait propose Taraji Mobile ?", points: 2, options: [{text: "Prépayé", correct: true}, {text: "Postpayé uniquement", correct: false}, {text: "Seulement roaming", correct: false}, {text: "Fibre uniquement", correct: false}] },
        { text: "Quelle application officielle pour les fans de l'EST ?", points: 2, options: [{text: "Taraji App", correct: true}, {text: "Facebook", correct: false}, {text: "Twitter", correct: false}, {text: "Instagram", correct: false}] },
        { text: "Quel avantage pour les abonnés Taraji Mobile ?", points: 3, options: [{text: "Billets match", correct: true}, {text: "Voiture", correct: false}, {text: "Maison", correct: false}, {text: "Avion", correct: false}] },
      ]
    },
    // CA Mobile - Quiz 1
    {
      brandIndex: 4, qmIndex: 8,
      title: "CA Mobile Banque Digitale",
      description: "Les services bancaires mobiles du Crédit Agricole.",
      category: "Banque Digitale",
      questions: [
        { text: "Quelle application mobile pour CA Mobile ?", points: 2, options: [{text: "CA Mobile", correct: true}, {text: "PayPal", correct: false}, {text: "Wise", correct: false}, {text: "Revolut", correct: false}] },
        { text: "Quel service permet les virements instantanés ?", points: 2, options: [{text: "Virement classique", correct: false}, {text: "Flash Transfer", correct: true}, {text: "Chèque", correct: false}, {text: "Espèces", correct: false}] },
        { text: "Quelle fonction pour payer les factures ?", points: 3, options: [{text: "Paiement factures", correct: true}, {text: "Virement", correct: false}, {text: "Retrait", correct: false}, {text: "Dépôt", correct: false}] },
      ]
    },
    // CA Mobile - Quiz 2
    {
      brandIndex: 4, qmIndex: 9,
      title: "CA Mobile Finance",
      description: "La finance et l'épargne avec Crédit Agricole Mobile.",
      category: "Finance",
      questions: [
        { text: "Quel produit d'épargne propose le CA ?", points: 2, options: [{text: "Compte d'épargne", correct: true}, {text: "Bitcoin", correct: false}, {text: "Actions", correct: false}, {text: "Immobilier", correct: false}] },
        { text: "Quelle assurance disponible via mobile ?", points: 3, options: [{text: "Assurance vie", correct: true}, {text: "Assurance voiture", correct: false}, {text: "Assurance maison", correct: false}, {text: "Toutes", correct: false}] },
        { text: "Quel crédit peut-on demander via l'app ?", points: 2, options: [{text: "Crédit conso", correct: true}, {text: "Crédit immo", correct: false}, {text: "Crédit auto", correct: false}, {text: "Aucun", correct: false}] },
      ]
    },
    // CSS Mobile - Quiz 1
    {
      brandIndex: 5, qmIndex: 10,
      title: "CSS Mobile & Football",
      description: "Le Club Sportif Sfaxien et ses succès sportifs.",
      category: "Sport",
      questions: [
        { text: "En quelle année a été fondé le CSS ?", points: 2, options: [{text: "1925", correct: false}, {text: "1928", correct: true}, {text: "1930", correct: false}, {text: "1956", correct: false}] },
        { text: "Combien de Ligue des Champions a remporté le CSS ?", points: 3, options: [{text: "1", correct: false}, {text: "2", correct: false}, {text: "3", correct: true}, {text: "0", correct: false}] },
        { text: "Quelle est la couleur du CSS ?", points: 1, options: [{text: "Rouge", correct: false}, {text: "Noir et Blanc", correct: true}, {text: "Vert", correct: false}, {text: "Bleu", correct: false}] },
      ]
    },
    // CSS Mobile - Quiz 2
    {
      brandIndex: 5, qmIndex: 11,
      title: "CSS Mobile Services",
      description: "Les services mobiles et offres du Club Sportif Sfaxien.",
      category: "Services Mobiles",
      questions: [
        { text: "Quel forfait mobile pour les fans du CSS ?", points: 2, options: [{text: "Forfait CSS", correct: true}, {text: "Forfait Standard", correct: false}, {text: "Forfait Basique", correct: false}, {text: "Pas de forfait", correct: false}] },
        { text: "Quel avantage pour les abonnés CSS Mobile ?", points: 2, options: [{text: "Billets prioritaires", correct: true}, {text: "Maillot gratuit", correct: false}, {text: "Voiture", correct: false}, {text: "Restaurant", correct: false}] },
        { text: "Quelle application pour suivre le CSS ?", points: 3, options: [{text: "CSS Mobile App", correct: true}, {text: "Facebook", correct: false}, {text: "Twitter", correct: false}, {text: "Snapchat", correct: false}] },
      ]
    },
  ];

  const quizzes = [];
  for (const template of quizTemplates) {
    const quiz = await prisma.quiz.create({
      data: {
        title: template.title,
        description: template.description,
        brandId: brands[template.brandIndex].id,
        quizmasterId: quizmasters[template.qmIndex].id,
        timeLimit: 300,
        pointsPerQuestion: 2,
        shuffleQuestions: true,
        isActive: true,
        difficulty: "medium",
        xpReward: 20,
        couponReward: 2,
        passingScore: 50,
        category: template.category,
        questions: {
          create: template.questions.map((q, idx) => ({
            text: q.text,
            points: q.points,
            order: idx + 1,
            difficulty: "medium",
            options: {
              create: q.options.map(opt => ({
                text: opt.text,
                isCorrect: opt.correct
              }))
            }
          }))
        },
      },
    });
    quizzes.push(quiz);
  }
  console.log(`📝  ${quizzes.length} Quizzes créés (${quizzes.length / 6} par brand)`);

  // ═══════════════════════════════════════════════════════════
  // 6. BADGES
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
  console.log(`🏅  ${badges.length} Badges créés`);

  // Assign badges aux participants
  await prisma.userBadge.createMany({
    data: [
      { userId: participants[0].id, badgeId: badges[0].id },
      { userId: participants[1].id, badgeId: badges[0].id },
      { userId: participants[1].id, badgeId: badges[1].id },
      { userId: participants[2].id, badgeId: badges[0].id },
      { userId: participants[2].id, badgeId: badges[1].id },
      { userId: participants[2].id, badgeId: badges[2].id },
      { userId: participants[2].id, badgeId: badges[4].id },
      { userId: participants[2].id, badgeId: badges[7].id },
    ],
  });
  console.log("🏅  Badges assignés aux participants");

  // ═══════════════════════════════════════════════════════════
  // 7. PRODUCTS - Pour chaque brand
  // ═══════════════════════════════════════════════════════════

  const productsData = [
    // Ooredoo products
    { brandIndex: 0, title: "Recharge Ooredoo 5DT", description: "Recharge téléphonique Ooredoo 5 dinars.", price: 5, stock: 1000, category: "Recharge" },
    { brandIndex: 0, title: "Forfait Internet 10Go", description: "Forfait internet mobile 10 Go valable 30 jours.", price: 10, stock: 500, category: "Forfait" },
    { brandIndex: 0, title: "T-Shirt Ooredoo", description: "T-shirt officiel Ooredoo, taille unique.", price: 15, stock: 50, category: "Vêtements" },
    // Orange products
    { brandIndex: 1, title: "Recharge Orange 5DT", description: "Recharge téléphonique Orange 5 dinars.", price: 5, stock: 1000, category: "Recharge" },
    { brandIndex: 1, title: "Pass Internet 20Go", description: "Pass internet 20 Go valable 30 jours.", price: 15, stock: 400, category: "Forfait" },
    { brandIndex: 1, title: "Casquette Orange", description: "Casquette officielle Orange.", price: 8, stock: 30, category: "Accessoires" },
    // Telecom products
    { brandIndex: 2, title: "Recharge TT 5DT", description: "Recharge Tunisie Telecom 5 dinars.", price: 5, stock: 1000, category: "Recharge" },
    { brandIndex: 2, title: "Forfait ADSL 1Mois", description: "Forfait ADSL 1 mois gratuit.", price: 25, stock: 100, category: "Internet" },
    { brandIndex: 2, title: "Mug TT", description: "Mug officiel Tunisie Telecom.", price: 6, stock: 40, category: "Accessoires" },
    // Taraji Mobile products
    { brandIndex: 3, title: "Recharge Taraji 5DT", description: "Recharge Taraji Mobile 5 dinars.", price: 5, stock: 1000, category: "Recharge" },
    { brandIndex: 3, title: "Maillot EST", description: "Maillot officiel Espérance de Tunis.", price: 50, stock: 20, category: "Sport" },
    { brandIndex: 3, title: "Ticket Match EST", description: "Billet prioritaire match EST.", price: 20, stock: 50, category: "Événement" },
    // CA Mobile products
    { brandIndex: 4, title: "Recharge CA 5DT", description: "Recharge CA Mobile 5 dinars.", price: 5, stock: 1000, category: "Recharge" },
    { brandIndex: 4, title: "Bon Achat CA", description: "Bon d'achat Crédit Agricole 10 DT.", price: 10, stock: 200, category: "Bon" },
    { brandIndex: 4, title: "Guide Épargne", description: "Guide complet pour l'épargne.", price: 3, stock: 100, category: "Éducation" },
    // CSS Mobile products
    { brandIndex: 5, title: "Recharge CSS 5DT", description: "Recharge CSS Mobile 5 dinars.", price: 5, stock: 1000, category: "Recharge" },
    { brandIndex: 5, title: "Maillot CSS", description: "Maillot officiel Club Sportif Sfaxien.", price: 45, stock: 25, category: "Sport" },
    { brandIndex: 5, title: "Écharpe CSS", description: "Écharpe officielle CSS.", price: 12, stock: 40, category: "Sport" },
  ];

  const products = [];
  for (const pData of productsData) {
    const p = await prisma.product.create({
      data: {
        brandId: brands[pData.brandIndex].id,
        title: pData.title,
        description: pData.description,
        price: pData.price,
        stock: pData.stock,
        category: pData.category,
        imageUrl: `https://placehold.co/400x400/${Math.floor(Math.random()*16777215).toString(16)}/white?text=${encodeURIComponent(pData.title.substring(0,10))}`,
      },
    });
    products.push(p);
  }
  console.log(`🛍️  ${products.length} Products créés`);

  // ═══════════════════════════════════════════════════════════
  // 8. ATTEMPTS & POINTS (Sample)
  // ═══════════════════════════════════════════════════════════

  // Sample attempts for first 3 participants
  const attemptsData = [
    { quizIndex: 0, userIndex: 2, score: 6, maxScore: 6, passed: true, xpEarned: 20, couponsEarned: 2 },
    { quizIndex: 1, userIndex: 2, score: 8, maxScore: 8, passed: true, xpEarned: 20, couponsEarned: 2 },
    { quizIndex: 2, userIndex: 1, score: 6, maxScore: 7, passed: true, xpEarned: 20, couponsEarned: 2 },
    { quizIndex: 0, userIndex: 0, score: 4, maxScore: 6, passed: false, xpEarned: 0, couponsEarned: 0 },
  ];

  const attempts = [];
  for (const aData of attemptsData) {
    const a = await prisma.attempt.create({
      data: {
        quizId: quizzes[aData.quizIndex].id,
        userId: participants[aData.userIndex].id,
        score: aData.score,
        maxScore: aData.maxScore,
        completedAt: new Date(),
        duration: 180,
        passed: aData.passed,
        xpEarned: aData.xpEarned,
        couponsEarned: aData.couponsEarned,
      },
    });
    attempts.push(a);
  }
  console.log(`📊  ${attempts.length} Attempts créés`);

  // Points history
  await prisma.pointsHistory.createMany({
    data: [
      { userId: participants[2].id, points: 20, reason: "Quiz terminé : Ooredoo Telecom Quiz" },
      { userId: participants[2].id, points: 20, reason: "Quiz terminé : Ooredoo Digital Services" },
      { userId: participants[1].id, points: 20, reason: "Quiz terminé : Orange Réseaux & Fibre" },
      { userId: participants[0].id, points: 10, reason: "Quiz terminé : Ooredoo Telecom Quiz" },
      { userId: participants[0].id, points: 5, reason: "Bonus d'inscription" },
    ],
  });
  console.log("�  Points history créé");

  // ═══════════════════════════════════════════════════════════
  // 9. ORDERS (Sample)
  // ═══════════════════════════════════════════════════════════

  await prisma.order.create({
    data: {
      userId: participants[2].id,
      totalPrice: 15,
      status: "confirmed",
      items: { create: [{ productId: products[2].id, quantity: 1, price: 15 }] },
    },
  });
  console.log("📦  Sample order créé");

  // ═══════════════════════════════════════════════════════════
  // 10. NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════

  await prisma.notification.createMany({
    data: [
      { userId: participants[0].id, type: "system", title: "Bienvenue !", message: "Bienvenue sur AcadeCom ! Jouez à un quiz pour gagner vos premiers points." },
      { userId: participants[1].id, type: "badge_earned", title: "Badge débloqué !", message: "Vous avez obtenu le badge 'Quizzeur Assidu' ! +25 XP" },
      { userId: participants[2].id, type: "level_up", title: "Niveau supérieur !", message: "Félicitations ! Vous êtes niveau 5 — Expert !", isRead: true },
      { userId: participants[2].id, type: "order_confirmed", title: "Commande confirmée", message: "Votre commande de T-Shirt Ooredoo a été confirmée.", isRead: true },
    ],
  });
  console.log("🔔  Notifications créées");

  // ═══════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════

  console.log("\n🎉 Seed completed successfully!");
  console.log("═══════════════════════════════════════════════════");
  console.log("📊 RÉCAPITULATIF:");
  console.log(`   👑  1 Admin`);
  console.log(`   🏢  ${brands.length} Brands (Ooredoo, Orange, Telecom, Taraji Mobile, CA Mobile, CSS Mobile)`);
  console.log(`   👨‍🏫  ${quizmasters.length} Quizmasters (2 par brand)`);
  console.log(`   🎮  ${participants.length} Participants`);
  console.log(`   📝  ${quizzes.length} Quizzes actifs (2 par brand)`);
  console.log(`   🏅  ${badges.length} Badges`);
  console.log(`   🛍️  ${products.length} Products`);
  console.log("═══════════════════════════════════════════════════");
  console.log("🔑 Test credentials (password: password123):");
  console.log("   Admin:         admin@acadecom.com");
  console.log("   Brands:        ooredoo@brand.com | orange@brand.com | telecom@brand.com");
  console.log("                  taraji@brand.com | camobile@brand.com | cssmobile@brand.com");
  console.log("   Quizmasters:   amir@ooredoo.com, sami@ooredoo.com, luc@orange.com, ...");
  console.log("   Participants:  ahmed@participant.com, sara@participant.com, ...");
  console.log("═══════════════════════════════════════════════════");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
