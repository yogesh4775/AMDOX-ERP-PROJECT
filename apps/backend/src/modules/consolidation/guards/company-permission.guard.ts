import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";

@Injectable()
export class CompanyPermissionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser;

    if (!user || !user.tenantId) {
      throw new ForbiddenException("Invalid authentication state");
    }

    // Admins bypass company-level checks
    const isAdmin = user.roles?.some((role) =>
      ["admin", "super admin", "super_admin"].includes(role.toLowerCase()),
    );
    if (isAdmin) {
      return true;
    }

    // Try to extract companyId from params, query, or body safely
    const companyId =
      request.params?.companyId ||
      request.query?.companyId ||
      request.body?.companyId ||
      request.params?.id; // Fallback for direct resource routes

    if (!companyId) {
      // If no companyId context, let it pass (rely on other guards)
      return true;
    }

    // Check if user has explicit permission for this company
    const permission = await this.prisma.companyPermission.findFirst({
      where: {
        tenantId: user.tenantId,
        userId: user.id,
        companyId: companyId,
      },
    });

    if (!permission) {
      throw new ForbiddenException("Access denied for this company");
    }

    return true;
  }
}
