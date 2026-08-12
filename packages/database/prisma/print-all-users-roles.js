const { PrismaClient } = require('c:/Users/ys070/amdox-erp/packages/database/generated');
const prisma = new PrismaClient();

async function run() {
  const users = await prisma.user.findMany({
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true
                }
              }
            }
          }
        }
      }
    }
  });

  for (const u of users) {
    console.log(`User: ${u.username} (${u.email})`);
    console.log(`  Tenant: ${u.tenantId}`);
    const roles = u.userRoles.map(ur => ur.role.name);
    console.log(`  Roles: ${roles.join(', ')}`);
    const perms = Array.from(new Set(u.userRoles.flatMap(ur => ur.role.rolePermissions.map(rp => rp.permission.name))));
    console.log(`  Permissions Count: ${perms.length}`);
    console.log(`  Permissions: ${perms.join(', ')}`);
    console.log('---');
  }
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
