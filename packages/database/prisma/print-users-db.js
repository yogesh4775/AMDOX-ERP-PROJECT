const { PrismaClient } = require('c:/Users/ys070/amdox-erp/packages/database/generated');
const prisma = new PrismaClient();

async function run() {
  console.log("=== Database Users ===");
  const users = await prisma.user.findMany();
  for (const u of users) {
    console.log(`User: ${u.username}, Email: ${u.email}, Hash: ${u.passwordHash.substring(0, 20)}..., Status: ${u.status}`);
  }
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
