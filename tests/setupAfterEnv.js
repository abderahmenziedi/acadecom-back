const prisma = require("../src/prisma/client");

afterAll(async () => {
  await prisma.$disconnect();
});
