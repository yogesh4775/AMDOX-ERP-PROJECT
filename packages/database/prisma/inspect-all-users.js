const { PrismaClient } = require('../generated');
const prisma = new PrismaClient();

async function main() {
  console.log("=== INSPECTING ALL DB USERS ===");
  const users = await prisma.user.findMany();

  for (const u of users) {
    console.log(`User: ${u.username} (${u.email})`);
    console.log(`  Password Hash: ${u.passwordHash}`);
    console.log(`  Failed Login Attempts: ${u.failedLoginAttempts}`);
    console.log(`  Locked Until: ${u.lockedUntil}`);
    console.log(`  Deleted At: ${u.deletedAt}`);
    console.log('---');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
