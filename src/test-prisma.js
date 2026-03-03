const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function test() {
  const users = await prisma.user.findMany();
  console.log(users);
}

test();