const { PrismaClient } = require('c:/Users/ys070/amdox-erp/packages/database/generated');
const prisma = new PrismaClient();

async function run() {
  const user = await prisma.user.findFirst({
    where: { username: 'admin' },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const roles = user.userRoles.map((ur) => ur.role.name);
  const permissions = Array.from(
    new Set(
      user.userRoles.flatMap((ur) =>
        ur.role.rolePermissions.map((rp) => rp.permission.name)
      )
    )
  );

  console.log("Roles from DB:", roles);
  console.log("Permissions count:", permissions.length);

  const isUserAdmin = roles.some((r) => {
    const role = r.toLowerCase().replace(/_/g, " ");
    return role === "admin" || role === "super admin";
  });
  console.log("isUserAdmin evaluated to:", isUserAdmin);
  
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
