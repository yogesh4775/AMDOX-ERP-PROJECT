import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { TransactionHelper } from "../../common/transactions/transaction.helper";
import { ErrorCode } from "../../common/errors/error-codes.enum";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { QueryRoleDto } from "./dto/query-role.dto";
import { AssignPermissionsDto } from "./dto/assign-permissions.dto";
import { CloneRoleDto } from "./dto/clone-role.dto";
import { Prisma } from "@amdox/database/generated";
import { AuditService } from "../../common/audit/audit.service";

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionHelper: TransactionHelper,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateRoleDto, tenantId: string, userId?: string) {
    const trimmedName = dto.name.trim();

    return this.transactionHelper.run(async (tx) => {
      const existing = await tx.role.findFirst({
        where: {
          tenantId,
          name: { equals: trimmedName, mode: "insensitive" },
          deletedAt: null,
        },
      });

      if (existing) {
        throw new ConflictException({
          message: "Role name already exists within the tenant",
          error: ErrorCode.DATABASE_CONFLICT,
        });
      }

      const role = await tx.role.create({
        data: {
          name: trimmedName,
          description: dto.description || null,
          tenantId,
          createdBy: userId || null,
        },
      });

      await this.auditService.logCreate(
        "Role",
        role.id,
        {
          name: role.name,
          description: role.description,
          isActive: role.isActive,
        },
        tx,
      );

      const created = await tx.role.findFirst({
        where: { id: role.id, tenantId, deletedAt: null },
        select: {
          id: true,
          name: true,
          description: true,
          isActive: true,
          isSystem: true,
          tenantId: true,
          version: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
          createdBy: true,
          updatedBy: true,
        },
      });

      if (!created) {
        throw new NotFoundException({
          message: "Role not found",
          error: ErrorCode.ROLE_NOT_FOUND,
        });
      }

      return created;
    });
  }

  async findAll(query: QueryRoleDto, tenantId: string) {
    const where: Prisma.RoleWhereInput = {
      tenantId,
      deletedAt: null,
    };

    if (query.name) {
      where.name = { contains: query.name, mode: "insensitive" };
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    const orderBy: Prisma.RoleOrderByWithRelationInput = {};
    if (query.sort) {
      orderBy[query.sort as keyof Prisma.RoleOrderByWithRelationInput] =
        query.order.toLowerCase() as Prisma.SortOrder;
    } else {
      orderBy.createdAt = "desc";
    }

    const [total, items] = await Promise.all([
      this.prisma.role.count({ where }),
      this.prisma.role.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          name: true,
          description: true,
          isActive: true,
          isSystem: true,
          tenantId: true,
          version: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
          createdBy: true,
          updatedBy: true,
          rolePermissions: {
            select: {
              permission: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / query.limit);

    return {
      data: items,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPreviousPage: query.page > 1,
      },
    };
  }

  async findOne(id: string, tenantId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        isSystem: true,
        tenantId: true,
        version: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        createdBy: true,
        updatedBy: true,
        rolePermissions: {
          select: {
            permission: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException({
        message: "Role not found",
        error: ErrorCode.ROLE_NOT_FOUND,
      });
    }

    return role;
  }

  async update(
    id: string,
    dto: UpdateRoleDto,
    tenantId: string,
    userId?: string,
  ) {
    return this.transactionHelper.run(async (tx) => {
      const role = await tx.role.findFirst({
        where: { id, tenantId, deletedAt: null },
      });

      if (!role) {
        throw new NotFoundException({
          message: "Role not found",
          error: ErrorCode.ROLE_NOT_FOUND,
        });
      }

      if (dto.name) {
        const trimmedName = dto.name.trim();
        const existing = await tx.role.findFirst({
          where: {
            id: { not: id },
            tenantId,
            name: { equals: trimmedName, mode: "insensitive" },
            deletedAt: null,
          },
        });

        if (existing) {
          throw new ConflictException({
            message: "Role name already exists within the tenant",
            error: ErrorCode.DATABASE_CONFLICT,
          });
        }
      }

      const result = await tx.role.updateMany({
        where: { id, tenantId, version: dto.version, deletedAt: null },
        data: {
          name: dto.name ? dto.name.trim() : undefined,
          description:
            dto.description !== undefined ? dto.description : undefined,
          isActive: dto.isActive !== undefined ? dto.isActive : undefined,
          updatedBy: userId || null,
          version: { increment: 1 },
        },
      });

      if (result.count === 0) {
        throw new ConflictException({
          message: "Concurrent modification error: Role version mismatch",
          error: ErrorCode.DATABASE_CONFLICT,
        });
      }

      await this.auditService.logUpdate(
        "Role",
        id,
        {
          name: role.name,
          description: role.description,
          isActive: role.isActive,
        },
        {
          name: dto.name ? dto.name.trim() : role.name,
          description:
            dto.description !== undefined ? dto.description : role.description,
          isActive: dto.isActive !== undefined ? dto.isActive : role.isActive,
        },
        tx,
      );

      const updated = await tx.role.findFirst({
        where: { id, tenantId, deletedAt: null },
        select: {
          id: true,
          name: true,
          description: true,
          isActive: true,
          isSystem: true,
          tenantId: true,
          version: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
          createdBy: true,
          updatedBy: true,
        },
      });

      if (!updated) {
        throw new NotFoundException({
          message: "Role not found",
          error: ErrorCode.ROLE_NOT_FOUND,
        });
      }

      return updated;
    });
  }

  async clone(
    id: string,
    dto: CloneRoleDto,
    tenantId: string,
    userId?: string,
  ) {
    return this.transactionHelper.run(async (tx) => {
      const sourceRole = await tx.role.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: {
          rolePermissions: true,
        },
      });

      if (!sourceRole) {
        throw new NotFoundException({
          message: "Source role not found",
          error: ErrorCode.ROLE_NOT_FOUND,
        });
      }

      let targetName = dto.name
        ? dto.name.trim()
        : `${sourceRole.name} (Clone)`;
      let uniqueFound = false;
      let counter = 1;

      while (!uniqueFound) {
        const conflict = await tx.role.findFirst({
          where: {
            tenantId,
            name: { equals: targetName, mode: "insensitive" },
            deletedAt: null,
          },
        });

        if (!conflict) {
          uniqueFound = true;
        } else {
          targetName = dto.name
            ? `${dto.name.trim()} (${counter})`
            : `${sourceRole.name} (Clone ${counter})`;
          counter++;
        }
      }

      // Create cloned role with version=1, timestamps=now, deletedAt=null, no user assignments
      const clonedRole = await tx.role.create({
        data: {
          name: targetName,
          description: sourceRole.description,
          isActive: sourceRole.isActive,
          isSystem: false, // Cloned roles are not system roles
          tenantId,
          createdBy: userId || null,
        },
      });

      // Clone permission mappings
      for (const mapping of sourceRole.rolePermissions) {
        await tx.rolePermission.create({
          data: {
            roleId: clonedRole.id,
            permissionId: mapping.permissionId,
            createdBy: userId || null,
          },
        });
      }

      await this.auditService.log(
        {
          action: "ROLE_CLONED",
          entity: "Role",
          entityId: clonedRole.id,
          newValues: {
            name: clonedRole.name,
            sourceRoleId: sourceRole.id,
          },
        },
        tx,
      );

      const created = await tx.role.findFirst({
        where: { id: clonedRole.id, tenantId, deletedAt: null },
        select: {
          id: true,
          name: true,
          description: true,
          isActive: true,
          isSystem: true,
          tenantId: true,
          version: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
          createdBy: true,
          updatedBy: true,
          rolePermissions: {
            select: {
              permission: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!created) {
        throw new NotFoundException({
          message: "Cloned role not found",
          error: ErrorCode.ROLE_NOT_FOUND,
        });
      }

      return created;
    });
  }

  async assignPermissions(
    id: string,
    dto: AssignPermissionsDto,
    tenantId: string,
    userId?: string,
  ) {
    return this.transactionHelper.run(async (tx) => {
      const role = await tx.role.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: {
          rolePermissions: {
            where: { deletedAt: null },
          },
        },
      });

      if (!role) {
        throw new NotFoundException({
          message: "Role not found",
          error: ErrorCode.ROLE_NOT_FOUND,
        });
      }

      // Validate duplicate permission IDs rejected in the request
      const uniquePermissionIds = Array.from(new Set(dto.permissionIds));
      if (uniquePermissionIds.length !== dto.permissionIds.length) {
        throw new BadRequestException({
          message: "Duplicate permission IDs are not allowed",
          error: ErrorCode.VALIDATION_INVALID_INPUT,
        });
      }

      // Verify that every permission exists and is active (deletedAt is null)
      const permissions = await tx.permission.findMany({
        where: {
          id: { in: dto.permissionIds },
          deletedAt: null,
        },
      });

      if (permissions.length !== dto.permissionIds.length) {
        throw new NotFoundException({
          message: "One or more permissions were not found or are inactive",
          error: ErrorCode.VALIDATION_INVALID_INPUT,
        });
      }

      // Update version using optimistic locking
      const result = await tx.role.updateMany({
        where: { id, tenantId, version: dto.version, deletedAt: null },
        data: {
          updatedBy: userId || null,
          version: { increment: 1 },
        },
      });

      if (result.count === 0) {
        throw new ConflictException({
          message: "Concurrent modification error: Role version mismatch",
          error: ErrorCode.DATABASE_CONFLICT,
        });
      }

      // Soft delete existing mappings
      await tx.rolePermission.updateMany({
        where: { roleId: id, deletedAt: null },
        data: {
          deletedAt: new Date(),
          updatedBy: userId || null,
        },
      });

      // Create or restore new mappings
      for (const permissionId of dto.permissionIds) {
        const existingMapping = await tx.rolePermission.findFirst({
          where: { roleId: id, permissionId },
        });

        if (existingMapping) {
          await tx.rolePermission.update({
            where: { id: existingMapping.id },
            data: {
              deletedAt: null,
              updatedBy: userId || null,
            },
          });
        } else {
          await tx.rolePermission.create({
            data: {
              roleId: id,
              permissionId,
              createdBy: userId || null,
            },
          });
        }
      }

      const oldPermissionIds = role.rolePermissions.map(
        (rp) => rp.permissionId,
      );
      await this.auditService.logUpdate(
        "Role",
        id,
        {
          permissionIds: oldPermissionIds,
        },
        {
          permissionIds: dto.permissionIds,
        },
        tx,
      );

      return { success: true };
    });
  }

  async remove(id: string, version: number, tenantId: string, userId?: string) {
    return this.transactionHelper.run(async (tx) => {
      const role = await tx.role.findFirst({
        where: { id, tenantId, deletedAt: null },
      });

      if (!role) {
        throw new NotFoundException({
          message: "Role not found",
          error: ErrorCode.ROLE_NOT_FOUND,
        });
      }

      // Reject deleting system roles
      if (role.isSystem) {
        throw new ConflictException({
          message: "Protected system roles cannot be deleted",
          error: ErrorCode.DATABASE_CONFLICT,
        });
      }

      // Reject deleting roles currently assigned to active users
      const activeUserCount = await tx.userRole.count({
        where: {
          roleId: id,
          deletedAt: null,
          user: {
            deletedAt: null,
          },
        },
      });

      if (activeUserCount > 0) {
        throw new ConflictException({
          message: "Cannot delete a role currently assigned to active users",
          error: ErrorCode.DATABASE_CONFLICT,
        });
      }

      const result = await tx.role.updateMany({
        where: { id, tenantId, version, deletedAt: null },
        data: {
          deletedAt: new Date(),
          updatedBy: userId || null,
          version: { increment: 1 },
        },
      });

      if (result.count === 0) {
        throw new ConflictException({
          message: "Concurrent modification error: Role version mismatch",
          error: ErrorCode.DATABASE_CONFLICT,
        });
      }

      // Soft delete corresponding rolePermissions
      await tx.rolePermission.updateMany({
        where: { roleId: id, deletedAt: null },
        data: {
          deletedAt: new Date(),
          updatedBy: userId || null,
        },
      });

      await this.auditService.logDelete(
        "Role",
        id,
        {
          name: role.name,
        },
        tx,
      );

      return { success: true };
    });
  }

  async restore(
    id: string,
    version: number,
    tenantId: string,
    userId?: string,
  ) {
    return this.transactionHelper.run(async (tx) => {
      const role = await tx.role.findFirst({
        where: { id, tenantId },
      });

      if (!role) {
        throw new NotFoundException({
          message: "Role not found",
          error: ErrorCode.ROLE_NOT_FOUND,
        });
      }

      if (role.deletedAt === null) {
        throw new BadRequestException({
          message: "Role is not deleted",
          error: ErrorCode.VALIDATION_INVALID_INPUT,
        });
      }

      const result = await tx.role.updateMany({
        where: { id, tenantId, version },
        data: {
          deletedAt: null,
          updatedBy: userId || null,
          version: { increment: 1 },
        },
      });

      if (result.count === 0) {
        throw new ConflictException({
          message: "Concurrent modification error: Role version mismatch",
          error: ErrorCode.DATABASE_CONFLICT,
        });
      }

      await this.auditService.logRestore("Role", id, tx);

      return { success: true };
    });
  }
}
