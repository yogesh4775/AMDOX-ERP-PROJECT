import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { TransactionHelper } from "../../common/transactions/transaction.helper";
import { ErrorCode } from "../../common/errors/error-codes.enum";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { QueryUserDto } from "./dto/query-user.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { AssignRolesDto } from "./dto/assign-roles.dto";
import { UpdateUserStatusDto } from "./dto/update-user-status.dto";
import { UserStatus, Prisma } from "@amdox/database/generated";
import { AuditService } from "../../common/audit/audit.service";
import * as argon2 from "argon2";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionHelper: TransactionHelper,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateUserDto, tenantId: string, userId?: string) {
    return this.transactionHelper.run(async (tx) => {
      const existing = await tx.user.findFirst({
        where: {
          OR: [{ email: dto.email }, { username: dto.username }],
        },
      });

      if (existing) {
        throw new ConflictException({
          message: "Email or Username already exists",
          error: ErrorCode.DATABASE_CONFLICT,
        });
      }

      const passwordHash = await argon2.hash(dto.password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });

      const user = await tx.user.create({
        data: {
          email: dto.email,
          username: dto.username,
          passwordHash,
          tenantId,
          createdBy: userId || null,
        },
      });

      await this.auditService.logCreate(
        "User",
        user.id,
        {
          email: user.email,
          username: user.username,
          status: user.status,
        },
        tx,
      );

      const created = await tx.user.findFirst({
        where: { id: user.id, tenantId, deletedAt: null },
        select: {
          id: true,
          email: true,
          username: true,
          status: true,
          lastLoginAt: true,
          tenantId: true,
          version: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
          createdBy: true,
          updatedBy: true,
          userRoles: {
            select: {
              role: {
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
          message: "User not found",
          error: ErrorCode.USER_NOT_FOUND,
        });
      }

      return created;
    });
  }

  async findAll(query: QueryUserDto, tenantId: string) {
    const where: Prisma.UserWhereInput = {
      tenantId,
      deletedAt: null,
    };

    if (query.email) {
      where.email = { contains: query.email, mode: "insensitive" };
    }
    if (query.username) {
      where.username = { contains: query.username, mode: "insensitive" };
    }
    if (query.status) {
      where.status = query.status as UserStatus;
    }
    if (query.roleId) {
      where.userRoles = {
        some: {
          roleId: query.roleId,
          deletedAt: null,
        },
      };
    }
    if (query.createdAt) {
      where.createdAt = { gte: new Date(query.createdAt) };
    }
    if (query.updatedAt) {
      where.updatedAt = { gte: new Date(query.updatedAt) };
    }

    const orderBy: Prisma.UserOrderByWithRelationInput = {};
    if (query.sort) {
      orderBy[query.sort as keyof Prisma.UserOrderByWithRelationInput] =
        query.order.toLowerCase() as Prisma.SortOrder;
    } else {
      orderBy.createdAt = "desc";
    }

    const [total, items] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          email: true,
          username: true,
          status: true,
          lastLoginAt: true,
          tenantId: true,
          version: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
          createdBy: true,
          updatedBy: true,
          userRoles: {
            select: {
              role: {
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
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: {
        id: true,
        email: true,
        username: true,
        status: true,
        lastLoginAt: true,
        tenantId: true,
        version: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        createdBy: true,
        updatedBy: true,
        userRoles: {
          select: {
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException({
        message: "User not found",
        error: ErrorCode.USER_NOT_FOUND,
      });
    }

    return user;
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    tenantId: string,
    userId?: string,
  ) {
    return this.transactionHelper.run(async (tx) => {
      const oldUser = await tx.user.findFirst({
        where: { id, tenantId, deletedAt: null },
      });

      if (!oldUser) {
        throw new NotFoundException({
          message: "User not found",
          error: ErrorCode.USER_NOT_FOUND,
        });
      }

      if (dto.email || dto.username) {
        const conflictCond: Prisma.UserWhereInput[] = [];
        if (dto.email) conflictCond.push({ email: dto.email });
        if (dto.username) conflictCond.push({ username: dto.username });

        const existing = await tx.user.findFirst({
          where: {
            id: { not: id },
            OR: conflictCond,
          },
        });

        if (existing) {
          throw new ConflictException({
            message: "Email or Username already exists",
            error: ErrorCode.DATABASE_CONFLICT,
          });
        }
      }

      const result = await tx.user.updateMany({
        where: { id, tenantId, version: dto.version, deletedAt: null },
        data: {
          email: dto.email,
          username: dto.username,
          updatedBy: userId || null,
          version: { increment: 1 },
        },
      });

      if (result.count === 0) {
        throw new ConflictException({
          message: "Concurrent modification error: User version mismatch",
          error: ErrorCode.DATABASE_CONFLICT,
        });
      }

      await this.auditService.logUpdate(
        "User",
        id,
        {
          email: oldUser.email,
          username: oldUser.username,
        },
        {
          email: dto.email,
          username: dto.username,
        },
        tx,
      );

      const updated = await tx.user.findFirst({
        where: { id, tenantId, deletedAt: null },
        select: {
          id: true,
          email: true,
          username: true,
          status: true,
          lastLoginAt: true,
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
          message: "User not found",
          error: ErrorCode.USER_NOT_FOUND,
        });
      }

      return updated;
    });
  }

  async changePassword(
    id: string,
    dto: ChangePasswordDto,
    tenantId: string,
    userId?: string,
  ) {
    return this.transactionHelper.run(async (tx) => {
      const user = await tx.user.findFirst({
        where: { id, tenantId, deletedAt: null },
      });

      if (!user) {
        throw new NotFoundException({
          message: "User not found",
          error: ErrorCode.USER_NOT_FOUND,
        });
      }

      const isSame = await argon2.verify(user.passwordHash, dto.password);
      if (isSame) {
        throw new BadRequestException({
          message: "Cannot reuse the current password",
          error: ErrorCode.VALIDATION_INVALID_INPUT,
        });
      }

      const passwordHash = await argon2.hash(dto.password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });

      const result = await tx.user.updateMany({
        where: { id, tenantId, version: dto.version, deletedAt: null },
        data: {
          passwordHash,
          version: { increment: 1 },
          updatedBy: userId || null,
        },
      });

      if (result.count === 0) {
        throw new ConflictException({
          message: "Concurrent modification error: User version mismatch",
          error: ErrorCode.DATABASE_CONFLICT,
        });
      }

      await this.auditService.log(
        {
          action: "PASSWORD_CHANGED",
          entity: "User",
          entityId: id,
        },
        tx,
      );

      return { success: true };
    });
  }

  async updateStatus(
    id: string,
    dto: UpdateUserStatusDto,
    tenantId: string,
    userId?: string,
  ) {
    return this.transactionHelper.run(async (tx) => {
      const oldUser = await tx.user.findFirst({
        where: { id, tenantId, deletedAt: null },
      });

      if (!oldUser) {
        throw new NotFoundException({
          message: "User not found",
          error: ErrorCode.USER_NOT_FOUND,
        });
      }

      const result = await tx.user.updateMany({
        where: { id, tenantId, version: dto.version, deletedAt: null },
        data: {
          status: dto.status as UserStatus,
          version: { increment: 1 },
          updatedBy: userId || null,
        },
      });

      if (result.count === 0) {
        throw new ConflictException({
          message: "Concurrent modification error: User version mismatch",
          error: ErrorCode.DATABASE_CONFLICT,
        });
      }

      await this.auditService.logUpdate(
        "User",
        id,
        {
          status: oldUser.status,
        },
        {
          status: dto.status,
        },
        tx,
      );

      const updated = await tx.user.findFirst({
        where: { id, tenantId, deletedAt: null },
        select: {
          id: true,
          email: true,
          username: true,
          status: true,
          lastLoginAt: true,
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
          message: "User not found",
          error: ErrorCode.USER_NOT_FOUND,
        });
      }

      return updated;
    });
  }

  async assignRoles(
    id: string,
    dto: AssignRolesDto,
    tenantId: string,
    userId?: string,
  ) {
    return this.transactionHelper.run(async (tx) => {
      const oldUser = await tx.user.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: {
          userRoles: {
            where: { deletedAt: null },
          },
        },
      });

      if (!oldUser) {
        throw new NotFoundException({
          message: "User not found",
          error: ErrorCode.USER_NOT_FOUND,
        });
      }

      const uniqueRoleIds = Array.from(new Set(dto.roleIds));
      if (uniqueRoleIds.length !== dto.roleIds.length) {
        throw new BadRequestException({
          message: "Duplicate role IDs are not allowed",
          error: ErrorCode.VALIDATION_INVALID_INPUT,
        });
      }

      const roles = await tx.role.findMany({
        where: {
          id: { in: dto.roleIds },
          tenantId,
          deletedAt: null,
        },
      });

      if (roles.length !== dto.roleIds.length) {
        throw new NotFoundException({
          message:
            "One or more roles were not found or do not belong to the same tenant",
          error: ErrorCode.VALIDATION_INVALID_INPUT,
        });
      }

      const userResult = await tx.user.updateMany({
        where: { id, tenantId, version: dto.version, deletedAt: null },
        data: {
          version: { increment: 1 },
          updatedBy: userId || null,
        },
      });

      if (userResult.count === 0) {
        throw new ConflictException({
          message: "Concurrent modification error: User version mismatch",
          error: ErrorCode.DATABASE_CONFLICT,
        });
      }

      // Soft delete current mappings
      await tx.userRole.updateMany({
        where: { userId: id, tenantId, deletedAt: null },
        data: {
          deletedAt: new Date(),
          updatedBy: userId || null,
        },
      });

      // Create or restore new mappings
      for (const roleId of dto.roleIds) {
        const existingMapping = await tx.userRole.findFirst({
          where: { userId: id, roleId },
        });

        if (existingMapping) {
          await tx.userRole.update({
            where: { id: existingMapping.id },
            data: {
              deletedAt: null,
              updatedBy: userId || null,
            },
          });
        } else {
          await tx.userRole.create({
            data: {
              userId: id,
              roleId,
              tenantId,
              createdBy: userId || null,
            },
          });
        }
      }

      const oldRoleIds = oldUser.userRoles.map((ur) => ur.roleId);
      await this.auditService.logUpdate(
        "User",
        id,
        {
          roleIds: oldRoleIds,
        },
        {
          roleIds: dto.roleIds,
        },
        tx,
      );

      return { success: true };
    });
  }

  async remove(id: string, version: number, tenantId: string, userId?: string) {
    return this.transactionHelper.run(async (tx) => {
      const user = await tx.user.findFirst({
        where: { id, tenantId, deletedAt: null },
      });

      if (!user) {
        throw new NotFoundException({
          message: "User not found",
          error: ErrorCode.USER_NOT_FOUND,
        });
      }

      // Verify no self-deletion
      if (id === userId) {
        throw new BadRequestException({
          message: "Cannot self-delete the authenticated user",
          error: ErrorCode.VALIDATION_INVALID_INPUT,
        });
      }

      const result = await tx.user.updateMany({
        where: { id, tenantId, version, deletedAt: null },
        data: {
          deletedAt: new Date(),
          updatedBy: userId || null,
          version: { increment: 1 },
        },
      });

      if (result.count === 0) {
        throw new ConflictException({
          message: "Concurrent modification error: User version mismatch",
          error: ErrorCode.DATABASE_CONFLICT,
        });
      }

      // Soft delete corresponding user sessions & user roles
      await tx.session.updateMany({
        where: { userId: id, tenantId, deletedAt: null },
        data: { deletedAt: new Date(), updatedBy: userId || null },
      });

      await tx.userRole.updateMany({
        where: { userId: id, tenantId, deletedAt: null },
        data: { deletedAt: new Date(), updatedBy: userId || null },
      });

      await this.auditService.logDelete(
        "User",
        id,
        {
          email: user.email,
          username: user.username,
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
      const user = await tx.user.findFirst({
        where: { id, tenantId },
      });

      if (!user) {
        throw new NotFoundException({
          message: "User not found",
          error: ErrorCode.USER_NOT_FOUND,
        });
      }

      if (user.deletedAt === null) {
        throw new BadRequestException({
          message: "User is not deleted",
          error: ErrorCode.VALIDATION_INVALID_INPUT,
        });
      }

      const result = await tx.user.updateMany({
        where: { id, tenantId, version },
        data: {
          deletedAt: null,
          updatedBy: userId || null,
          version: { increment: 1 },
        },
      });

      if (result.count === 0) {
        throw new ConflictException({
          message: "Concurrent modification error: User version mismatch",
          error: ErrorCode.DATABASE_CONFLICT,
        });
      }

      await this.auditService.logRestore("User", id, tx);

      return { success: true };
    });
  }
}
