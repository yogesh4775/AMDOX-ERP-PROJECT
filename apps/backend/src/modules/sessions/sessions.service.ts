import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { TransactionHelper } from "../../common/transactions/transaction.helper";
import { ErrorCode } from "../../common/errors/error-codes.enum";
import { QuerySessionDto, SessionStatusFilter } from "./dto/query-session.dto";
import { RevokeSessionDto } from "./dto/revoke-session.dto";
import { AuditService } from "../../common/audit/audit.service";
import { AuthUser } from "../auth/interfaces/auth-user.interface";
import { Prisma } from "@amdox/database/generated";

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionHelper: TransactionHelper,
    private readonly auditService: AuditService,
  ) {}

  private getSessionStatus(session: {
    revokedAt: Date | null;
    expiresAt: Date;
  }): "ACTIVE" | "REVOKED" | "EXPIRED" {
    const now = new Date();
    if (session.revokedAt !== null) {
      return "REVOKED";
    }
    if (session.expiresAt <= now) {
      return "EXPIRED";
    }
    return "ACTIVE";
  }

  async getSessions(query: QuerySessionDto, user: AuthUser) {
    const isTenantAdmin =
      user.permissions?.includes("session:read") &&
      user.roles?.includes("Admin");

    const where: Prisma.SessionWhereInput = {
      tenantId: user.tenantId,
      deletedAt: null,
    };

    // If not admin, restrict to user's own sessions
    if (!isTenantAdmin) {
      where.userId = user.id;
    } else if (query.userId) {
      where.userId = query.userId;
    }

    // Status filter logic
    if (query.status) {
      const now = new Date();
      if (query.status === SessionStatusFilter.ACTIVE) {
        where.revokedAt = null;
        where.expiresAt = { gt: now };
      } else if (query.status === SessionStatusFilter.REVOKED) {
        where.revokedAt = { not: null };
      } else if (query.status === SessionStatusFilter.EXPIRED) {
        where.revokedAt = null;
        where.expiresAt = { lte: now };
      }
    }

    // Date filters logic
    if (query.createdAtFrom || query.createdAtTo) {
      where.createdAt = {};
      if (query.createdAtFrom)
        where.createdAt.gte = new Date(query.createdAtFrom);
      if (query.createdAtTo) where.createdAt.lte = new Date(query.createdAtTo);
    }

    if (query.expiresAtFrom || query.expiresAtTo) {
      where.expiresAt = {};
      if (query.expiresAtFrom)
        where.expiresAt.gte = new Date(query.expiresAtFrom);
      if (query.expiresAtTo) where.expiresAt.lte = new Date(query.expiresAtTo);
    }

    if (query.revokedAtFrom || query.revokedAtTo) {
      where.revokedAt = {};
      if (query.revokedAtFrom)
        where.revokedAt.gte = new Date(query.revokedAtFrom);
      if (query.revokedAtTo) where.revokedAt.lte = new Date(query.revokedAtTo);
    }

    // Current session filter logic
    if (query.isCurrent !== undefined) {
      const isCurrentBool = query.isCurrent === "true";
      if (isCurrentBool) {
        where.id = user.sessionId;
      } else {
        where.id = { not: user.sessionId };
      }
    }

    // Device / userAgent search logic
    if (query.device) {
      where.userAgent = { contains: query.device, mode: "insensitive" };
    }

    // IP Address search logic
    if (query.ipAddress) {
      where.ipAddress = { contains: query.ipAddress, mode: "insensitive" };
    }

    // Sorting logic
    const orderBy: Prisma.SessionOrderByWithRelationInput = {};
    if (query.sort) {
      const sortField =
        query.sort === "lastActivityAt" ? "updatedAt" : query.sort;
      orderBy[sortField as keyof Prisma.SessionOrderByWithRelationInput] =
        query.order.toLowerCase() as Prisma.SortOrder;
    } else {
      orderBy.createdAt = "desc";
    }

    const [total, items] = await Promise.all([
      this.prisma.session.count({ where }),
      this.prisma.session.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          userId: true,
          tenantId: true,
          expiresAt: true,
          revokedAt: true,
          ipAddress: true,
          userAgent: true,
          version: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
          createdBy: true,
          updatedBy: true,
        },
      }),
    ]);

    const mappedItems = items.map((item) => ({
      ...item,
      status: this.getSessionStatus(item),
      lastActivityAt: item.updatedAt, // virtual field matching display requirements
    }));

    const totalPages = Math.ceil(total / query.limit);

    return {
      data: mappedItems,
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

  async getSessionDetails(id: string, user: AuthUser) {
    const session = await this.prisma.session.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        tenantId: true,
        expiresAt: true,
        revokedAt: true,
        ipAddress: true,
        userAgent: true,
        version: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        createdBy: true,
        updatedBy: true,
      },
    });

    if (!session || session.deletedAt !== null) {
      throw new NotFoundException({
        message: "Session not found",
        error: ErrorCode.VALIDATION_INVALID_INPUT,
      });
    }

    // Tenant isolation: cannot access session belonging to another tenant
    if (session.tenantId !== user.tenantId) {
      throw new NotFoundException({
        message: "Session not found",
        error: ErrorCode.VALIDATION_INVALID_INPUT,
      });
    }

    // Auth check: non-admin can view only their own session details
    const isTenantAdmin =
      user.permissions?.includes("session:read") &&
      user.roles?.includes("Admin");
    if (session.userId !== user.id && !isTenantAdmin) {
      throw new ForbiddenException({
        message: "You do not have permission to view this session",
        error: ErrorCode.AUTH_FORBIDDEN,
      });
    }

    await this.auditService.log({
      action: "SESSION_VIEWED",
      entity: "Session",
      entityId: session.id,
      newValues: {
        viewedBy: user.id,
        sessionId: session.id,
      },
    });

    return {
      ...session,
      status: this.getSessionStatus(session),
      lastActivityAt: session.updatedAt,
    };
  }

  async revokeSession(id: string, dto: RevokeSessionDto, user: AuthUser) {
    return this.transactionHelper.run(async (tx) => {
      const session = await tx.session.findUnique({
        where: { id },
      });

      if (!session || session.deletedAt !== null) {
        throw new NotFoundException({
          message: "Session not found",
          error: ErrorCode.VALIDATION_INVALID_INPUT,
        });
      }

      // Tenant isolation: cannot manage session belonging to another tenant
      if (session.tenantId !== user.tenantId) {
        throw new NotFoundException({
          message: "Session not found",
          error: ErrorCode.VALIDATION_INVALID_INPUT,
        });
      }

      // Owner check: non-admin can only revoke their own session
      const isOwner = session.userId === user.id;
      const hasRevokePerm = user.permissions?.includes("session:revoke");
      if (!isOwner && !hasRevokePerm) {
        throw new ForbiddenException({
          message: "You do not have permission to revoke this session",
          error: ErrorCode.AUTH_FORBIDDEN,
        });
      }

      if (session.revokedAt !== null) {
        throw new BadRequestException({
          message: "Session is already revoked",
          error: ErrorCode.VALIDATION_INVALID_INPUT,
        });
      }

      if (session.expiresAt <= new Date()) {
        throw new BadRequestException({
          message: "Session is already expired",
          error: ErrorCode.VALIDATION_INVALID_INPUT,
        });
      }

      // Optimistic concurrency check
      if (dto.version !== undefined && session.version !== dto.version) {
        throw new ConflictException({
          message: "Concurrent modification error: Session version mismatch",
          error: ErrorCode.DATABASE_CONFLICT,
        });
      }

      const updated = await tx.session.update({
        where: { id },
        data: {
          revokedAt: new Date(),
          version: { increment: 1 },
        },
      });

      await this.auditService.log(
        {
          action: "SESSION_REVOKED",
          entity: "Session",
          entityId: session.id,
          oldValues: { revokedAt: null },
          newValues: { revokedAt: updated.revokedAt },
        },
        tx,
      );

      return { success: true };
    });
  }

  async revokeAllSessionsIncludingCurrent(user: AuthUser) {
    return this.transactionHelper.run(async (tx) => {
      const hasRevokeAllPerm =
        user.permissions?.includes("session:revoke-all") &&
        user.roles?.includes("Admin");

      const whereClause: Prisma.SessionWhereInput = {
        tenantId: user.tenantId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        deletedAt: null,
      };

      if (!hasRevokeAllPerm) {
        whereClause.userId = user.id;
      }

      const result = await tx.session.updateMany({
        where: whereClause,
        data: {
          revokedAt: new Date(),
        },
      });

      if (result.count > 0) {
        await this.auditService.log(
          {
            action: "SESSION_REVOKED_ALL",
            entity: "Session",
            entityId: user.tenantId,
            newValues: {
              revokedCount: result.count,
              revokedBy: user.id,
              scope: hasRevokeAllPerm ? "tenant" : "user",
              type: "all",
            },
          },
          tx,
        );
      }

      return { success: true, count: result.count };
    });
  }

  async revokeAllSessionsExceptCurrent(user: AuthUser) {
    return this.transactionHelper.run(async (tx) => {
      const hasRevokeAllPerm =
        user.permissions?.includes("session:revoke-all") &&
        user.roles?.includes("Admin");

      const whereClause: Prisma.SessionWhereInput = {
        tenantId: user.tenantId,
        id: { not: user.sessionId },
        revokedAt: null,
        expiresAt: { gt: new Date() },
        deletedAt: null,
      };

      if (!hasRevokeAllPerm) {
        whereClause.userId = user.id;
      }

      const result = await tx.session.updateMany({
        where: whereClause,
        data: {
          revokedAt: new Date(),
        },
      });

      if (result.count > 0) {
        await this.auditService.log(
          {
            action: "SESSION_REVOKED_ALL",
            entity: "Session",
            entityId: user.tenantId,
            newValues: {
              revokedCount: result.count,
              revokedBy: user.id,
              scope: hasRevokeAllPerm ? "tenant" : "user",
              type: "except-current",
            },
          },
          tx,
        );
      }

      return { success: true, count: result.count };
    });
  }
}
