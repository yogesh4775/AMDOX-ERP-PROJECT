const { PrismaClient } = require('c:/Users/ys070/amdox-erp/packages/database/generated');
const prisma = new PrismaClient();

async function run() {
  const rolePermissionsCount = await prisma.rolePermission.count();
  console.log("Total RolePermissions in DB:", rolePermissionsCount);
  
  const roles = await prisma.role.findMany({
    include: {
      rolePermissions: true
    }
  });
  
  for (const r of roles) {
    console.log(`Role: ${r.name} (Tenant: ${r.tenantId}) has ${r.rolePermissions.length} permissions`);
  }
  
  const permissionsCount = await prisma.permission.count();
  console.log("Total Permissions in DB:", permissionsCount);
  
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
