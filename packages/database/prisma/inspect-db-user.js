const { PrismaClient } = require('../generated');
const prisma = new PrismaClient();

async function main() {
  console.log("=== INSPECTING DB USER ===");
  const user = await prisma.user.findFirst({
    where: { email: "admin@amdox.com" },
  });

  if (!user) {
    console.log("admin@amdox.com not found!");
  } else {
    console.log("User found:");
    console.log("ID:", user.id);
    console.log("Email:", user.email);
    console.log("Username:", user.username);
    console.log("Password Hash:", user.passwordHash);
    console.log("Failed Login Attempts:", user.failedLoginAttempts);
    console.log("Locked Until:", user.lockedUntil);
    console.log("Deleted At:", user.deletedAt);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
