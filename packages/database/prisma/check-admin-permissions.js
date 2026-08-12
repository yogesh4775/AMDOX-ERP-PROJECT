const { PrismaClient } = require('c:/Users/ys070/amdox-erp/packages/database/generated');
const prisma = new PrismaClient();

async function run() {
  console.log("Checking admin user permissions...");
  const user = await prisma.user.findFirst({
    where: { username: "admin" },
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

  if (!user) {
    console.log("No user with username admin found.");
    process.exit(0);
  }

  console.log(`User: ${user.username}, email: ${user.email}`);
  const roles = user.userRoles.map(ur => ur.role.name);
  console.log("Roles:", roles);
  
  const permissions = user.userRoles.flatMap(ur => ur.role.rolePermissions.map(rp => rp.permission.name));
  console.log(`Total permissions count: ${permissions.length}`);
  console.log("First 10 permissions:", permissions.slice(0, 10));
  
  // Let's print all permissions that have "read" in their name
  const readPerms = permissions.filter(p => p.includes("read"));
  console.log("Read permissions:", readPerms);

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
