import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "@amdox/database";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { AuthUser } from "../interfaces/auth-user.interface";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser;

    if (!user) {
      throw new ForbiddenException();
    }

    if (!user.roles || !user.permissions) {
      const userData = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: {
          userRoles: {
            select: {
              role: {
                select: {
                  name: true,
                  rolePermissions: {
                    select: {
                      permission: {
                        select: {
                          name: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!userData) {
        throw new ForbiddenException();
      }

      user.roles = userData.userRoles.map((ur) => ur.role.name);
      user.permissions = userData.userRoles.flatMap((ur) =>
        ur.role.rolePermissions.map((rp) => rp.permission.name),
      );
    }

    // Bypass permissions check for Admin/Super Admin/SUPER_ADMIN roles
    const isAdmin = user.roles?.some((role) =>
      ["admin", "super admin", "super_admin"].includes(role.toLowerCase()),
    );
    if (isAdmin) {
      return true;
    }

    const hasPermission = requiredPermissions.every((permission) =>
      user.permissions?.includes(permission),
    );

    if (!hasPermission) {
      throw new ForbiddenException();
    }

    return true;
  }
}
