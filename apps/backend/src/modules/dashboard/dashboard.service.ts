import { Injectable } from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { QueryDashboardDto } from "./dto/query-dashboard.dto";
import { AuditService } from "../../common/audit/audit.service";
import { AuthUser } from "../auth/interfaces/auth-user.interface";
import { Prisma } from "@amdox/database/generated";

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getDashboardSummary(
    user: AuthUser,
    query?: QueryDashboardDto,
    skipAudit = false,
  ) {
    const companyId = query?.companyId;

    // 1. Resolve organization/company name
    let organizationName = "My Organization";
    if (companyId) {
      const company = await this.prisma.company.findFirst({
        where: { id: companyId, tenantId: user.tenantId },
      });
      if (company) {
        organizationName = company.name;
      }
    } else {
      const firstCompany = await this.prisma.company.findFirst({
        where: { tenantId: user.tenantId },
        orderBy: { name: "asc" },
      });
      if (firstCompany) {
        organizationName = firstCompany.name;
      }
    }

    // 2. Fetch counts in parallel
    const [
      companyCount,
      departmentCount,
      productCount,
      warehouseCount,
      userCount,
      purchaseOrderCount,
      salesOrderCount,
      unreadNotificationsCount,
      pendingApprovals,
      stockAggregate,
    ] = await Promise.all([
      this.prisma.company.count({
        where: { tenantId: user.tenantId },
      }),
      this.prisma.department.count({
        where: { tenantId: user.tenantId, deletedAt: null },
      }),
      this.prisma.product.count({
        where: { tenantId: user.tenantId, deletedAt: null },
      }),
      this.prisma.warehouse.count({
        where: {
          tenantId: user.tenantId,
          companyId: companyId || undefined,
          deletedAt: null,
        },
      }),
      this.prisma.user.count({
        where: { tenantId: user.tenantId, deletedAt: null },
      }),
      this.prisma.purchaseOrder.count({
        where: {
          tenantId: user.tenantId,
          companyId: companyId || undefined,
          deletedAt: null,
        },
      }),
      this.prisma.salesOrder.count({
        where: {
          tenantId: user.tenantId,
          companyId: companyId || undefined,
          deletedAt: null,
        },
      }),
      this.prisma.notification.count({
        where: { userId: user.id, isRead: false },
      }),
      this.prisma.workflowInstanceStep.count({
        where: {
          tenantId: user.tenantId,
          status: "PENDING",
          assignedApproverId: user.id,
        },
      }),
      this.prisma.stock.aggregate({
        where: {
          tenantId: user.tenantId,
          warehouse: companyId ? { companyId } : undefined,
        },
        _sum: { quantity: true },
      }),
    ]);

    const inventoryStock = stockAggregate._sum.quantity
      ? Number(stockAggregate._sum.quantity)
      : 0;

    const summary = {
      companyCount,
      departmentCount,
      productCount,
      warehouseCount,
      userCount,
      purchaseOrderCount,
      salesOrderCount,
      unreadNotificationsCount,
      pendingApprovals,
      inventoryStock,
      organizationName,
    };

    if (!skipAudit) {
      await this.auditService.log({
        action: "DASHBOARD_VIEWED",
        entity: "Dashboard",
        entityId: user.tenantId,
        newValues: {
          type: "summary",
          userId: user.id,
          companyId,
        },
      });
    }

    return summary;
  }

  async getDashboardCharts(user: AuthUser, query?: QueryDashboardDto) {
    const companyId = query?.companyId;
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const chartData = [];
    const now = new Date();

    // Generate monthly series for the last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      chartData.push({
        name: months[d.getMonth()],
        year: d.getFullYear(),
        monthNum: d.getMonth(),
        Revenue: 0,
        Expenses: 0,
      });
    }

    const startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    startDate.setHours(0, 0, 0, 0);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId: user.tenantId,
        companyId: companyId || undefined,
        createdAt: { gte: startDate },
        status: { in: ["ISSUED", "PARTIALLY_PAID", "PAID"] },
        deletedAt: null,
      },
      select: {
        type: true,
        grandTotal: true,
        createdAt: true,
      },
    });

    for (const invoice of invoices) {
      const invDate = new Date(invoice.createdAt);
      const dataPoint = chartData.find(
        (point) =>
          point.monthNum === invDate.getMonth() &&
          point.year === invDate.getFullYear(),
      );
      if (dataPoint) {
        const val = Number(invoice.grandTotal) || 0;
        if (invoice.type === "SALES") {
          dataPoint.Revenue += val;
        } else if (invoice.type === "PURCHASE") {
          dataPoint.Expenses += val;
        }
      }
    }

    return chartData.map((d) => ({
      name: d.name,
      Revenue: Number(d.Revenue.toFixed(2)),
      Expenses: Number(d.Expenses.toFixed(2)),
    }));
  }

  async getRecentActivityFeed(user: AuthUser, query?: QueryDashboardDto) {
    const isSystemAdmin =
      user.tenantId === "00000000-0000-0000-0000-000000000000" &&
      user.roles?.includes("Admin");

    const where: Prisma.AuditLogWhereInput = {};

    if (!isSystemAdmin) {
      where.tenantId = user.tenantId;
    } else if (query?.tenant) {
      where.tenantId = query.tenant;
    }

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        userId: true,
        createdAt: true,
      },
    });
  }

  async getDashboardNotifications(user: AuthUser) {
    return this.prisma.notification.findMany({
      where: {
        userId: user.id,
        isRead: false,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
  }

  async getRecentActivity(
    query: QueryDashboardDto,
    user: AuthUser,
    skipAudit = false,
  ) {
    const isSystemAdmin =
      user.tenantId === "00000000-0000-0000-0000-000000000000" &&
      user.roles?.includes("Admin");

    const where: Prisma.AuditLogWhereInput = {};

    if (!isSystemAdmin) {
      where.tenantId = user.tenantId;
    } else if (query.tenant) {
      where.tenantId = query.tenant;
    }

    if (query.entity) {
      where.entity = query.entity;
    }

    if (query.action) {
      where.action = query.action;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const [total, items] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          action: true,
          entity: true,
          entityId: true,
          userId: true,
          tenantId: true,
          requestId: true,
          ipAddress: true,
          createdAt: true,
        },
      }),
    ]);

    const totalPages = Math.ceil(total / query.limit);

    if (!skipAudit) {
      await this.auditService.log({
        action: "DASHBOARD_VIEWED",
        entity: "Dashboard",
        entityId: user.tenantId,
        newValues: {
          type: "activity",
          userId: user.id,
        },
      });
    }

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

  async getDashboardCombined(query: QueryDashboardDto, user: AuthUser) {
    const [summary, charts, activity, notifications] = await Promise.all([
      this.getDashboardSummary(user, query, true),
      this.getDashboardCharts(user, query),
      this.getRecentActivityFeed(user, query),
      this.getDashboardNotifications(user),
    ]);

    await this.auditService.log({
      action: "DASHBOARD_VIEWED",
      entity: "Dashboard",
      entityId: user.tenantId,
      newValues: {
        type: "combined",
        userId: user.id,
        companyId: query.companyId,
      },
    });

    return {
      summary,
      charts,
      activity,
      notifications,
    };
  }
}
