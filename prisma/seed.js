const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // Clear existing data (order matters for FK constraints)
  await prisma.answer.deleteMany();
  await prisma.pointsHistory.deleteMany();
  await prisma.attempt.deleteMany();
  await prisma.option.deleteMany();
  await prisma.question.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.user.deleteMany();

  console.log('✅  Cleared existing data');

  const password = await bcrypt.hash('password123', 10);

  // 1. Create Admin
  const admin = await prisma.user.create({
    data: {
      name: 'Admin Principal',
      email: 'admin@acadecom.com',
      password,
      role: 'admin',
    },
  });
  console.log(`👑  Admin created: ${admin.email}`);

  // 2. Create Brand
  const brand = await prisma.user.create({
    data: {
      name: 'TechCorp',
      email: 'brand@acadecom.com',
      password,
      role: 'brand',
      industry: 'Technologie',
      description: 'Entreprise leader en solutions technologiques innovantes.',
    },
  });
  console.log(`🏢  Brand created: ${brand.email}`);

  // 3. Create Quizmaster (linked to brand)
  const quizmaster = await prisma.user.create({
    data: {
      name: 'Jean Quiz',
      email: 'quizmaster@acadecom.com',
      password,
      role: 'quizmaster',
      brandId: brand.id,
    },
  });
  console.log(`👨‍🏫  Quizmaster created: ${quizmaster.email}`);

  // 4. Create Participant
  const participant = await prisma.user.create({
    data: {
      name: 'Marie Participante',
      email: 'participant@acadecom.com',
      password,
      role: 'participant',
      totalPoints: 0,
    },
  });
  console.log(`🎮  Participant created: ${participant.email}`);

  // 5. Create Quiz with Questions
  const quiz = await prisma.quiz.create({
    data: {
      title: 'Culture Générale Tech',
      description: 'Testez vos connaissances en technologie et informatique !',
      brandId: brand.id,
      quizmasterId: quizmaster.id,
      timeLimit: 300,
      pointsPerQuestion: 2,
      shuffleQuestions: false,
      isActive: true,
      questions: {
        create: [
          {
            text: 'Quel langage de programmation est principalement utilisé pour le développement web frontend ?',
            points: 2,
            order: 1,
            options: {
              create: [
                { text: 'Python', isCorrect: false },
                { text: 'JavaScript', isCorrect: true },
                { text: 'Java', isCorrect: false },
                { text: 'C++', isCorrect: false },
              ],
            },
          },
          {
            text: 'Que signifie HTML ?',
            points: 2,
            order: 2,
            options: {
              create: [
                { text: 'Hyper Text Markup Language', isCorrect: true },
                { text: 'High Tech Modern Language', isCorrect: false },
                { text: 'Hyper Transfer Markup Language', isCorrect: false },
                { text: 'Home Tool Markup Language', isCorrect: false },
              ],
            },
          },
          {
            text: 'Quel est le système de gestion de versions le plus populaire ?',
            points: 2,
            order: 3,
            options: {
              create: [
                { text: 'SVN', isCorrect: false },
                { text: 'Mercurial', isCorrect: false },
                { text: 'Git', isCorrect: true },
                { text: 'CVS', isCorrect: false },
              ],
            },
          },
          {
            text: 'Quelle base de données est de type NoSQL ?',
            points: 2,
            order: 4,
            options: {
              create: [
                { text: 'MySQL', isCorrect: false },
                { text: 'PostgreSQL', isCorrect: false },
                { text: 'MongoDB', isCorrect: true },
                { text: 'Oracle', isCorrect: false },
              ],
            },
          },
          {
            text: 'Que signifie API ?',
            points: 2,
            order: 5,
            options: {
              create: [
                { text: 'Application Programming Interface', isCorrect: true },
                { text: 'Advanced Program Integration', isCorrect: false },
                { text: 'Automated Process Interface', isCorrect: false },
                { text: 'Application Process Integration', isCorrect: false },
              ],
            },
          },
        ],
      },
    },
  });
  console.log(`📝  Quiz created: "${quiz.title}" (${5} questions)`);

  // 6. Create a second quiz
  const quiz2 = await prisma.quiz.create({
    data: {
      title: 'Cybersécurité Basics',
      description: 'Les fondamentaux de la sécurité informatique.',
      brandId: brand.id,
      quizmasterId: quizmaster.id,
      timeLimit: 180,
      pointsPerQuestion: 3,
      shuffleQuestions: true,
      isActive: true,
      questions: {
        create: [
          {
            text: 'Quel protocole sécurise les communications web ?',
            points: 3,
            order: 1,
            options: {
              create: [
                { text: 'HTTP', isCorrect: false },
                { text: 'HTTPS', isCorrect: true },
                { text: 'FTP', isCorrect: false },
                { text: 'SMTP', isCorrect: false },
              ],
            },
          },
          {
            text: 'Qu\'est-ce qu\'un pare-feu (firewall) ?',
            points: 3,
            order: 2,
            options: {
              create: [
                { text: 'Un antivirus', isCorrect: false },
                { text: 'Un système qui filtre le trafic réseau', isCorrect: true },
                { text: 'Un protocole de chiffrement', isCorrect: false },
                { text: 'Un type de malware', isCorrect: false },
              ],
            },
          },
          {
            text: 'Quelle attaque consiste à envoyer des emails frauduleux ?',
            points: 3,
            order: 3,
            options: {
              create: [
                { text: 'DDoS', isCorrect: false },
                { text: 'SQL Injection', isCorrect: false },
                { text: 'Phishing', isCorrect: true },
                { text: 'Brute Force', isCorrect: false },
              ],
            },
          },
        ],
      },
    },
  });
  console.log(`📝  Quiz created: "${quiz2.title}" (${3} questions)`);

  console.log('\n✨ Seed completed successfully!');
  console.log('\n📋 Login credentials (all passwords: password123):');
  console.log('   Admin:       admin@acadecom.com');
  console.log('   Brand:       brand@acadecom.com');
  console.log('   Quizmaster:  quizmaster@acadecom.com');
  console.log('   Participant:  participant@acadecom.com');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
