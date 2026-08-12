import { PrismaClient } from "@amdox/database/generated";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  console.log("Setting up admin user...");

  const defaultTenantId = "00000000-0000-0000-0000-000000000000";

  const passwordHash = await argon2.hash("Password_1234_Special!", {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const user = await prisma.user.upsert({
    where: { email: "admin@amdox.com" },
    update: {
      passwordHash,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    create: {
      email: "admin@amdox.com",
      username: "admin_user",
      passwordHash,
      tenantId: defaultTenantId,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  const role = await prisma.role.upsert({
    where: {
      name_tenantId: {
        name: "Admin",
        tenantId: defaultTenantId,
      },
    },
    update: {},
    create: {
      name: "Admin",
      tenantId: defaultTenantId,
    },
  });

  const permissions = await prisma.permission.findMany();

  for (const perm of permissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: role.id,
        permissionId: perm.id,
      },
    });
  }

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: role.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: role.id,
      tenantId: defaultTenantId,
    },
  });

  console.log("Admin user setup completed successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
