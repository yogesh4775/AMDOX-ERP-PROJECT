import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import {
  TransactionHelper,
  PrismaTx,
} from "../../common/transactions/transaction.helper";
import { ErrorCode } from "../../common/errors/error-codes.enum";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import { UpdateTenantDto } from "./dto/update-tenant.dto";
import { QueryTenantDto } from "./dto/query-tenant.dto";
import { TenantStatus, Prisma } from "@amdox/database/generated";
import { AuditService } from "../../common/audit/audit.service";

@Injectable()
export class TenantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionHelper: TransactionHelper,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateTenantDto, userId?: string) {
    return this.transactionHelper.run(async (tx) => {
      const existing = await tx.tenant.findFirst({
        where: { slug: dto.slug.toLowerCase() },
      });

      if (existing) {
        throw new ConflictException({
          message: "Slug already exists",
          error: ErrorCode.DATABASE_CONFLICT,
        });
      }

      const tenant = await tx.tenant.create({
        data: {
          name: dto.name,
          slug: dto.slug.toLowerCase(),
          createdBy: userId || null,
        },
      });

      await this.auditService.logCreate(
        "Tenant",
        tenant.id,
        {
          name: tenant.name,
          slug: tenant.slug,
          status: tenant.status,
        },
        tx,
      );

      const created = await tx.tenant.findFirst({
        where: { id: tenant.id, deletedAt: null },
      });

      if (!created) {
        throw new NotFoundException({
          message: "Tenant not found",
          error: ErrorCode.TENANT_NOT_FOUND,
        });
      }

      return created;
    });
  }

  async findAll(query: QueryTenantDto) {
    const where: Prisma.TenantWhereInput = {
      deletedAt: null,
    };

    if (query.name) {
      where.name = { contains: query.name, mode: "insensitive" };
    }
    if (query.slug) {
      where.slug = { contains: query.slug, mode: "insensitive" };
    }
    if (query.status) {
      where.status = query.status as TenantStatus;
    }

    const orderBy: Prisma.TenantOrderByWithRelationInput = {};
    if (query.sort) {
      orderBy[query.sort as keyof Prisma.TenantOrderByWithRelationInput] =
        query.order.toLowerCase() as Prisma.SortOrder;
    } else {
      orderBy.createdAt = "desc";
    }

    const [total, items] = await Promise.all([
      this.prisma.tenant.count({ where }),
      this.prisma.tenant.findMany({
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
    const tenant = await this.prisma.tenant.findFirst({
      where: { id, deletedAt: null },
    });

    if (!tenant) {
      throw new NotFoundException({
        message: "Tenant not found",
        error: ErrorCode.TENANT_NOT_FOUND,
      });
    }

    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto, userId?: string) {
    return this.transactionHelper.run(async (tx) => {
      const oldTenant = await tx.tenant.findFirst({
        where: { id, deletedAt: null },
      });

      if (!oldTenant) {
        throw new NotFoundException({
          message: "Tenant not found",
          error: ErrorCode.TENANT_NOT_FOUND,
        });
      }

      const result = await tx.tenant.updateMany({
        where: { id, version: dto.version, deletedAt: null },
        data: {
          name: dto.name,
          status: dto.status as TenantStatus,
          updatedBy: userId || null,
          version: { increment: 1 },
        },
      });

      if (result.count === 0) {
        throw new ConflictException({
          message: "Concurrent modification error: Tenant version mismatch",
          error: ErrorCode.DATABASE_CONFLICT,
        });
      }

      await this.auditService.logUpdate(
        "Tenant",
        id,
        {
          name: oldTenant.name,
          status: oldTenant.status,
        },
        {
          name: dto.name || oldTenant.name,
          status: dto.status || oldTenant.status,
        },
        tx,
      );

      const updated = await tx.tenant.findFirst({
        where: { id, deletedAt: null },
      });

      if (!updated) {
        throw new NotFoundException({
          message: "Tenant not found",
          error: ErrorCode.TENANT_NOT_FOUND,
        });
      }

      return updated;
    });
  }

  private async checkTenantDependencies(
    id: string,
    tx: PrismaTx,
  ): Promise<void> {
    const activeUserCount = await tx.user.count({
      where: {
        tenantId: id,
        deletedAt: null,
      },
    });

    if (activeUserCount > 0) {
      throw new ConflictException({
        message: "Cannot delete tenant with active users",
        error: ErrorCode.DATABASE_CONFLICT,
      });
    }
  }

  async remove(id: string, version: number, userId?: string) {
    return this.transactionHelper.run(async (tx) => {
      const tenant = await tx.tenant.findFirst({
        where: { id, deletedAt: null },
      });

      if (!tenant) {
        throw new NotFoundException({
          message: "Tenant not found",
          error: ErrorCode.TENANT_NOT_FOUND,
        });
      }

      await this.checkTenantDependencies(id, tx);

      const result = await tx.tenant.updateMany({
        where: { id, version, deletedAt: null },
        data: {
          deletedAt: new Date(),
          updatedBy: userId || null,
          version: { increment: 1 },
        },
      });

      if (result.count === 0) {
        throw new ConflictException({
          message: "Concurrent modification error: Tenant version mismatch",
          error: ErrorCode.DATABASE_CONFLICT,
        });
      }

      await this.auditService.logDelete(
        "Tenant",
        id,
        {
          name: tenant.name,
          slug: tenant.slug,
        },
        tx,
      );

      return { success: true };
    });
  }
}
