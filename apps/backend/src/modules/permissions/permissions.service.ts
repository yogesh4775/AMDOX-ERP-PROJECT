import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { TransactionHelper } from "../../common/transactions/transaction.helper";
import { ErrorCode } from "../../common/errors/error-codes.enum";
import { CreatePermissionDto } from "./dto/create-permission.dto";
import { UpdatePermissionDto } from "./dto/update-permission.dto";
import { QueryPermissionDto } from "./dto/query-permission.dto";
import { Prisma } from "@amdox/database/generated";
import { AuditService } from "../../common/audit/audit.service";

@Injectable()
export class PermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionHelper: TransactionHelper,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreatePermissionDto, userId?: string) {
    const normalizedName = dto.name.trim().toLowerCase();

    // Verify format at service level
    if (!/^[a-z]+:[a-z-]+$/.test(normalizedName)) {
      throw new BadRequestException({
        message:
          "Permission name must match format: resource:action (e.g. user:create)",
        error: ErrorCode.VALIDATION_INVALID_INPUT,
      });
    }

    return this.transactionHelper.run(async (tx) => {
      const existing = await tx.permission.findFirst({
        where: { name: normalizedName },
      });

      if (existing) {
        if (existing.deletedAt !== null) {
          throw new ConflictException({
            message:
              "Permission already exists but is soft-deleted. Please restore it.",
            error: ErrorCode.DATABASE_CONFLICT,
          });
        }
        throw new ConflictException({
          message: "Permission name already exists",
          error: ErrorCode.DATABASE_CONFLICT,
        });
      }

      const permission = await tx.permission.create({
        data: {
          name: normalizedName,
          description: dto.description || null,
          isSystem: false,
          createdBy: userId || null,
        },
      });

      await this.auditService.logCreate(
        "Permission",
        permission.id,
        {
          name: permission.name,
          description: permission.description,
          isSystem: permission.isSystem,
        },
        tx,
      );

      return permission;
    });
  }

  async findAll(query: QueryPermissionDto) {
    const where: Prisma.PermissionWhereInput = {
      deletedAt: null,
    };

    if (query.name) {
      where.name = { contains: query.name, mode: "insensitive" };
    }
    if (query.description) {
      where.description = { contains: query.description, mode: "insensitive" };
    }

    const orderBy: Prisma.PermissionOrderByWithRelationInput = {};
    if (query.sort && ["name", "createdAt", "updatedAt"].includes(query.sort)) {
      orderBy[query.sort as "name" | "createdAt" | "updatedAt"] =
        query.order.toLowerCase() as Prisma.SortOrder;
    } else {
      orderBy.createdAt = "desc";
    }

    const [total, items] = await Promise.all([
      this.prisma.permission.count({ where }),
      this.prisma.permission.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
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

  async findOne(id: string) {
    const permission = await this.prisma.permission.findFirst({
      where: { id, deletedAt: null },
    });

    if (!permission) {
      throw new NotFoundException({
        message: "Permission not found",
        error: ErrorCode.USER_NOT_FOUND, // Reusing existing error codes mapping
      });
    }

    return permission;
  }

  async update(id: string, dto: UpdatePermissionDto, userId?: string) {
    return this.transactionHelper.run(async (tx) => {
      const permission = await tx.permission.findFirst({
        where: { id, deletedAt: null },
      });

      if (!permission) {
        throw new NotFoundException({
          message: "Permission not found",
          error: ErrorCode.USER_NOT_FOUND,
        });
      }

      // Reject modification of system permissions
      if (permission.isSystem) {
        throw new ConflictException({
          message: "Protected system permissions cannot be modified",
          error: ErrorCode.DATABASE_CONFLICT,
        });
      }

      const result = await tx.permission.updateMany({
        where: { id, version: dto.version, deletedAt: null },
        data: {
          description:
            dto.description !== undefined ? dto.description : undefined,
          updatedBy: userId || null,
          version: { increment: 1 },
        },
      });

      if (result.count === 0) {
        throw new ConflictException({
          message: "Concurrent modification error: Permission version mismatch",
          error: ErrorCode.DATABASE_CONFLICT,
        });
      }

      await this.auditService.logUpdate(
        "Permission",
        id,
        {
          description: permission.description,
        },
        {
          description:
            dto.description !== undefined
              ? dto.description
              : permission.description,
        },
        tx,
      );

      const updated = await tx.permission.findFirst({
        where: { id, deletedAt: null },
      });

      if (!updated) {
        throw new NotFoundException({
          message: "Permission not found",
          error: ErrorCode.USER_NOT_FOUND,
        });
      }

      return updated;
    });
  }

  async remove(id: string, version: number, userId?: string) {
    return this.transactionHelper.run(async (tx) => {
      const permission = await tx.permission.findFirst({
        where: { id, deletedAt: null },
      });

      if (!permission) {
        throw new NotFoundException({
          message: "Permission not found",
          error: ErrorCode.USER_NOT_FOUND,
        });
      }

      // Reject deleting system permissions
      if (permission.isSystem) {
        throw new ConflictException({
          message: "Protected system permissions cannot be deleted",
          error: ErrorCode.DATABASE_CONFLICT,
        });
      }

      // Verify no active RolePermission mappings reference it
      const activeRoleCount = await tx.rolePermission.count({
        where: {
          permissionId: id,
          deletedAt: null,
          role: {
            deletedAt: null,
          },
        },
      });

      if (activeRoleCount > 0) {
        throw new ConflictException({
          message: "Cannot delete permission assigned to active roles",
          error: ErrorCode.DATABASE_CONFLICT,
        });
      }

      const result = await tx.permission.updateMany({
        where: { id, version, deletedAt: null },
        data: {
          deletedAt: new Date(),
          updatedBy: userId || null,
          version: { increment: 1 },
        },
      });

      if (result.count === 0) {
        throw new ConflictException({
          message: "Concurrent modification error: Permission version mismatch",
          error: ErrorCode.DATABASE_CONFLICT,
        });
      }

      await this.auditService.logDelete(
        "Permission",
        id,
        {
          name: permission.name,
        },
        tx,
      );

      return { success: true };
    });
  }

  async restore(id: string, version: number, userId?: string) {
    return this.transactionHelper.run(async (tx) => {
      const permission = await tx.permission.findFirst({
        where: { id },
      });

      if (!permission) {
        throw new NotFoundException({
          message: "Permission not found",
          error: ErrorCode.USER_NOT_FOUND,
        });
      }

      if (permission.deletedAt === null) {
        throw new BadRequestException({
          message: "Permission is not deleted",
          error: ErrorCode.VALIDATION_INVALID_INPUT,
        });
      }

      const result = await tx.permission.updateMany({
        where: { id, version },
        data: {
          deletedAt: null,
          updatedBy: userId || null,
          version: { increment: 1 },
        },
      });

      if (result.count === 0) {
        throw new ConflictException({
          message: "Concurrent modification error: Permission version mismatch",
          error: ErrorCode.DATABASE_CONFLICT,
        });
      }

      await this.auditService.logRestore("Permission", id, tx);

      return { success: true };
    });
  }
}
