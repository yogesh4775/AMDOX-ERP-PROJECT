const { PrismaClient } = require('c:/Users/ys070/amdox-erp/packages/database/generated');
const prisma = new PrismaClient();

async function run() {
  const roles = await prisma.role.findMany({
    include: {
      rolePermissions: {
        include: {
          permission: true
        }
      }
    }
  });
  console.log(`Total roles in DB: ${roles.length}`);
  roles.forEach(r => {
    console.log(`Role: ${r.name}, description: ${r.description}, permissions count: ${r.rolePermissions.length}`);
  });
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
