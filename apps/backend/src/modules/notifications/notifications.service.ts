import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import {
  TransactionHelper,
  PrismaTx,
} from "../../common/transactions/transaction.helper";
import { AuditService } from "../../common/audit/audit.service";
import {
  QueryNotificationDto,
  NotificationType,
} from "./dto/query-notification.dto";
import { MarkReadDto } from "./dto/mark-read.dto";
import { DeleteNotificationDto } from "./dto/delete-notification.dto";
import { AuthUser } from "../auth/interfaces/auth-user.interface";
import { Prisma } from "@amdox/database/generated";

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly transactionHelper: TransactionHelper,
  ) {}

  async findAll(query: QueryNotificationDto, user: AuthUser) {
    const isTenantAdmin = user.roles?.includes("Admin");
    const where: Prisma.NotificationWhereInput = {};

    // Tenant Isolation & Role access rules
    if (isTenantAdmin) {
      where.user = {
        tenantId: user.tenantId,
      };
    } else {
      where.userId = user.id;
    }

    // Filter by type
    if (query.type) {
      where.type = query.type;
    }

    // Filter by unread status
    if (query.unreadOnly) {
      where.isRead = false;
    }

    // Filter by date ranges (Type safe DateTimeFilter mapping)
    const createdAtFilter: Prisma.DateTimeFilter = {};
    let hasCreatedAtFilter = false;

    if (query.startDate) {
      createdAtFilter.gte = new Date(query.startDate);
      hasCreatedAtFilter = true;
    }
    if (query.endDate) {
      createdAtFilter.lte = new Date(query.endDate);
      hasCreatedAtFilter = true;
    }
    if (query.createdAtFrom) {
      createdAtFilter.gte = new Date(query.createdAtFrom);
      hasCreatedAtFilter = true;
    }
    if (query.createdAtTo) {
      createdAtFilter.lte = new Date(query.createdAtTo);
      hasCreatedAtFilter = true;
    }

    if (hasCreatedAtFilter) {
      where.createdAt = createdAtFilter;
    }

    // Sorting
    const sortField = query.sort || "createdAt";
    const order = query.order || "desc";

    const [total, items] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { [sortField]: order },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          tenantId: true,
          userId: true,
          title: true,
          message: true,
          type: true,
          isRead: true,
          metadata: true,
          version: true,
          createdAt: true,
          updatedAt: true,
          readAt: true,
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

  async findOne(id: string, user: AuthUser) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            tenantId: true,
          },
        },
      },
    });

    if (!notification) {
      throw new NotFoundException("Notification not found");
    }

    const isTenantAdmin = user.roles?.includes("Admin");

    // Access control
    if (isTenantAdmin) {
      if (notification.user.tenantId !== user.tenantId) {
        throw new ForbiddenException(
          "Access denied to cross-tenant notification",
        );
      }
    } else {
      if (notification.userId !== user.id) {
        throw new ForbiddenException("Access denied to this notification");
      }
    }

    // Strip sensitive relation fields cleanly without unused variables or cast properties
    return {
      id: notification.id,
      tenantId: notification.tenantId,
      userId: notification.userId,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      isRead: notification.isRead,
      metadata: notification.metadata,
      version: notification.version,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
      readAt: notification.readAt,
    };
  }

  async markAsRead(id: string, dto: MarkReadDto, user: AuthUser) {
    return this.transactionHelper.run(async (tx) => {
      const notification = await tx.notification.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              tenantId: true,
            },
          },
        },
      });

      if (!notification) {
        throw new NotFoundException("Notification not found");
      }

      const isTenantAdmin = user.roles?.includes("Admin");

      // Access control
      if (isTenantAdmin) {
        if (notification.user.tenantId !== user.tenantId) {
          throw new ForbiddenException(
            "Access denied to cross-tenant notification",
          );
        }
      } else {
        if (notification.userId !== user.id) {
          throw new ForbiddenException("Access denied to this notification");
        }
      }

      // Reject duplicate read operations
      if (notification.isRead) {
        throw new BadRequestException("Notification is already marked as read");
      }

      // Optimistic concurrency validation
      if (
        dto.expectedVersion !== undefined &&
        notification.version !== dto.expectedVersion
      ) {
        throw new ConflictException(
          "Concurrent modification error: Notification version mismatch",
        );
      }

      const updated = await tx.notification.update({
        where: { id },
        data: {
          isRead: true,
          readAt: new Date(),
          version: { increment: 1 },
        },
        select: {
          id: true,
          isRead: true,
          version: true,
          readAt: true,
        },
      });

      await this.auditService.log(
        {
          action: "NOTIFICATION_READ",
          entity: "Notification",
          entityId: notification.id,
          oldValues: { isRead: false },
          newValues: { isRead: true, readAt: updated.readAt },
        },
        tx,
      );

      return { success: true };
    });
  }

  async markAllAsRead(user: AuthUser) {
    return this.transactionHelper.run(async (tx) => {
      const isTenantAdmin = user.roles?.includes("Admin");
      const where: Prisma.NotificationWhereInput = {
        isRead: false,
      };

      if (isTenantAdmin) {
        where.user = {
          tenantId: user.tenantId,
        };
      } else {
        where.userId = user.id;
      }

      // Fetch unread notifications to check if state changes
      const unreadNotifications = await tx.notification.findMany({
        where,
        select: { id: true },
      });

      if (unreadNotifications.length === 0) {
        return { success: true, count: 0 };
      }

      const updated = await tx.notification.updateMany({
        where,
        data: {
          isRead: true,
          readAt: new Date(),
          version: { increment: 1 },
        },
      });

      await this.auditService.log(
        {
          action: "NOTIFICATION_READ_ALL",
          entity: "Notification",
          entityId: user.tenantId,
          newValues: {
            scope: isTenantAdmin ? "tenant" : "user",
            userId: user.id,
            count: updated.count,
          },
        },
        tx,
      );

      return { success: true, count: updated.count };
    });
  }

  async delete(id: string, dto: DeleteNotificationDto, user: AuthUser) {
    return this.transactionHelper.run(async (tx) => {
      const notification = await tx.notification.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              tenantId: true,
            },
          },
        },
      });

      if (!notification) {
        throw new NotFoundException("Notification not found");
      }

      const isTenantAdmin = user.roles?.includes("Admin");

      // Access control
      if (isTenantAdmin) {
        if (notification.user.tenantId !== user.tenantId) {
          throw new ForbiddenException(
            "Access denied to cross-tenant notification",
          );
        }
      } else {
        if (notification.userId !== user.id) {
          throw new ForbiddenException("Access denied to this notification");
        }
      }

      // Optimistic concurrency validation
      if (
        dto.expectedVersion !== undefined &&
        notification.version !== dto.expectedVersion
      ) {
        throw new ConflictException(
          "Concurrent modification error: Notification version mismatch",
        );
      }

      await tx.notification.delete({
        where: { id },
      });

      await this.auditService.log(
        {
          action: "NOTIFICATION_DELETED",
          entity: "Notification",
          entityId: notification.id,
          newValues: {
            deletedId: notification.id,
            title: notification.title,
          },
        },
        tx,
      );

      return { success: true };
    });
  }

  async deleteAll(user: AuthUser) {
    return this.transactionHelper.run(async (tx) => {
      const isTenantAdmin = user.roles?.includes("Admin");
      const where: Prisma.NotificationWhereInput = {};

      if (isTenantAdmin) {
        where.user = {
          tenantId: user.tenantId,
        };
      } else {
        where.userId = user.id;
      }

      const notificationsCount = await tx.notification.count({ where });

      if (notificationsCount === 0) {
        return { success: true, count: 0 };
      }

      const deleted = await tx.notification.deleteMany({
        where,
      });

      await this.auditService.log(
        {
          action: "NOTIFICATION_DELETED_ALL",
          entity: "Notification",
          entityId: user.tenantId,
          newValues: {
            scope: isTenantAdmin ? "tenant" : "user",
            userId: user.id,
            count: deleted.count,
          },
        },
        tx,
      );

      return { success: true, count: deleted.count };
    });
  }

  async createInternal(
    data: {
      userId: string;
      tenantId?: string;
      title: string;
      message: string;
      type?: NotificationType;
      metadata?: Prisma.InputJsonValue;
    },
    tx?: PrismaTx,
  ) {
    const runBody = async (client: PrismaTx) => {
      const notification = await client.notification.create({
        data: {
          userId: data.userId,
          tenantId: data.tenantId || null,
          title: data.title,
          message: data.message,
          type: data.type || "INFO",
          metadata: data.metadata || {},
        },
        select: {
          id: true,
          title: true,
          type: true,
          createdAt: true,
        },
      });

      await this.auditService.log(
        {
          action: "NOTIFICATION_CREATED",
          entity: "Notification",
          entityId: notification.id,
          newValues: {
            id: notification.id,
            title: notification.title,
            type: notification.type,
          },
        },
        client,
      );

      return notification;
    };

    if (tx) {
      return runBody(tx);
    }
    return this.transactionHelper.run(runBody);
  }
}
