const { PrismaClient } = require('c:/Users/ys070/amdox-erp/packages/database/generated');
const argon2 = require('argon2');
const prisma = new PrismaClient();

async function run() {
  const user = await prisma.user.findFirst({ where: { username: "admin" } });
  if (!user) {
    console.log("No admin user found");
    process.exit(1);
  }
  console.log("Hash in DB:", user.passwordHash);
  
  const passwordsToTest = ["Password_1234_Special!", "admin", "adminPassword", "Password123!", "Password123"];
  for (const pw of passwordsToTest) {
    try {
      const isValid = await argon2.verify(user.passwordHash, pw);
      console.log(`Password "${pw}": ${isValid ? "VALID" : "INVALID"}`);
    } catch (e) {
      console.log(`Password "${pw}": Error during verify:`, e.message);
    }
  }
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
