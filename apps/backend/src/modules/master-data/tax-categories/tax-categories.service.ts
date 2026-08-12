import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { TransactionHelper } from "../../../common/transactions/transaction.helper";
import { AuditService } from "../../../common/audit/audit.service";
import { MasterDependencyRegistry } from "../master-dependency.registry";
import { normalizeName } from "../master-data.helper";
import { CreateTaxCategoryDto } from "./dto/create-tax-category.dto";
import { UpdateTaxCategoryDto } from "./dto/update-tax-category.dto";
import { QueryTaxCategoryDto } from "./dto/query-tax-category.dto";
import { DeleteTaxCategoryDto } from "./dto/delete-tax-category.dto";
import { RestoreTaxCategoryDto } from "./dto/restore-tax-category.dto";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";
import { Prisma } from "@amdox/database/generated";

@Injectable()
export class TaxCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly transactionHelper: TransactionHelper,
    private readonly dependencyRegistry: MasterDependencyRegistry,
  ) {}

  async create(dto: CreateTaxCategoryDto, user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    const normalized = normalizeName(dto.name);

    return this.transactionHelper.run(async (tx) => {
      const existing = await tx.taxCategory.findFirst({
        where: {
          tenantId: user.tenantId!,
          deletedAt: null,
          name: { equals: normalized, mode: "insensitive" },
        },
      });

      if (existing) {
        throw new BadRequestException(
          "A tax category with this name already exists.",
        );
      }

      if (dto.isDefault === true) {
        await tx.taxCategory.updateMany({
          where: { tenantId: user.tenantId!, deletedAt: null },
          data: { isDefault: false },
        });
      }

      const record = await tx.taxCategory.create({
        data: {
          tenantId: user.tenantId!,
          name: normalized,
          rate: dto.rate !== undefined ? new Prisma.Decimal(dto.rate) : null,
          isDefault: dto.isDefault || false,
          description: dto.description || null,
          status: dto.status || "ACTIVE",
        },
      });

      await this.auditService.log(
        {
          action: "TAX_CATEGORY_CREATED",
          entity: "TaxCategory",
          entityId: record.id,
          newValues: {
            id: record.id,
            name: record.name,
            rate: record.rate,
            isDefault: record.isDefault,
            status: record.status,
          },
        },
        tx,
      );

      return record;
    });
  }

  async findAll(query: QueryTaxCategoryDto, user: AuthUser) {
    const where: Prisma.TaxCategoryWhereInput = {
      tenantId: user.tenantId!,
    };

    if (!query.includeDeleted) {
      where.deletedAt = null;
    }

    if (query.name) {
      where.name = { contains: query.name, mode: "insensitive" };
    }

    if (query.status) {
      where.status = query.status;
    }

    const sortField = query.sort || "createdAt";
    const order = query.order || "desc";

    const [total, items] = await Promise.all([
      this.prisma.taxCategory.count({ where }),
      this.prisma.taxCategory.findMany({
        where,
        orderBy: { [sortField]: order },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          tenantId: true,
          name: true,
          rate: true,
          isDefault: true,
          description: true,
          status: true,
          version: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
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
    const record = await this.prisma.taxCategory.findUnique({
      where: { id },
    });

    if (!record || record.deletedAt) {
      throw new NotFoundException("Tax category not found");
    }

    if (record.tenantId !== user.tenantId) {
      throw new ForbiddenException("Access denied.");
    }

    return record;
  }

  async update(id: string, dto: UpdateTaxCategoryDto, user: AuthUser) {
    return this.transactionHelper.run(async (tx) => {
      const record = await tx.taxCategory.findUnique({
        where: { id },
      });

      if (!record || record.deletedAt) {
        throw new NotFoundException("Tax category not found");
      }

      if (record.tenantId !== user.tenantId) {
        throw new ForbiddenException("Access denied.");
      }

      if (record.version !== dto.expectedVersion) {
        throw new ConflictException(
          "Concurrent modification error: Version mismatch",
        );
      }

      const updateData: Prisma.TaxCategoryUpdateInput = {};

      if (dto.name !== undefined) {
        const normalized = normalizeName(dto.name);
        if (normalized.toLowerCase() !== record.name.toLowerCase()) {
          const duplicate = await tx.taxCategory.findFirst({
            where: {
              tenantId: user.tenantId!,
              deletedAt: null,
              name: { equals: normalized, mode: "insensitive" },
            },
          });
          if (duplicate) {
            throw new BadRequestException(
              "A tax category with this name already exists.",
            );
          }
        }
        updateData.name = normalized;
      }

      if (dto.isDefault !== undefined) {
        if (dto.isDefault === true) {
          await tx.taxCategory.updateMany({
            where: { tenantId: user.tenantId!, deletedAt: null },
            data: { isDefault: false },
          });
        }
        updateData.isDefault = dto.isDefault;
      }

      if (dto.rate !== undefined) {
        updateData.rate =
          dto.rate !== null ? new Prisma.Decimal(dto.rate) : null;
      }

      if (dto.description !== undefined) {
        updateData.description = dto.description || null;
      }

      if (dto.status !== undefined) {
        updateData.status = dto.status;
      }

      updateData.version = { increment: 1 };

      const updated = await tx.taxCategory.update({
        where: { id },
        data: updateData,
      });

      await this.auditService.log(
        {
          action: "TAX_CATEGORY_UPDATED",
          entity: "TaxCategory",
          entityId: id,
          oldValues: {
            name: record.name,
            rate: record.rate,
            isDefault: record.isDefault,
            status: record.status,
          },
          newValues: {
            name: updated.name,
            rate: updated.rate,
            isDefault: updated.isDefault,
            status: updated.status,
          },
        },
        tx,
      );

      return updated;
    });
  }

  async delete(id: string, dto: DeleteTaxCategoryDto, user: AuthUser) {
    return this.transactionHelper.run(async (tx) => {
      const record = await tx.taxCategory.findUnique({
        where: { id },
      });

      if (!record || record.deletedAt) {
        throw new NotFoundException("Tax category not found");
      }

      if (record.tenantId !== user.tenantId) {
        throw new ForbiddenException("Access denied.");
      }

      if (
        dto.expectedVersion !== undefined &&
        record.version !== dto.expectedVersion
      ) {
        throw new ConflictException(
          "Concurrent modification error: Version mismatch",
        );
      }

      await this.dependencyRegistry.validateDeletion(
        "TaxCategory",
        this.prisma,
        id,
        user.tenantId!,
      );

      const deleted = await tx.taxCategory.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          version: { increment: 1 },
        },
      });

      await this.auditService.log(
        {
          action: "TAX_CATEGORY_DELETED",
          entity: "TaxCategory",
          entityId: id,
          newValues: {
            deletedId: id,
            name: record.name,
          },
        },
        tx,
      );

      return deleted;
    });
  }

  async restore(id: string, dto: RestoreTaxCategoryDto, user: AuthUser) {
    return this.transactionHelper.run(async (tx) => {
      const record = await tx.taxCategory.findUnique({
        where: { id },
      });

      if (!record || !record.deletedAt) {
        throw new NotFoundException("Soft-deleted tax category not found");
      }

      if (record.tenantId !== user.tenantId) {
        throw new ForbiddenException("Access denied.");
      }

      if (
        dto.expectedVersion !== undefined &&
        record.version !== dto.expectedVersion
      ) {
        throw new ConflictException(
          "Concurrent modification error: Version mismatch",
        );
      }

      const duplicate = await tx.taxCategory.findFirst({
        where: {
          tenantId: user.tenantId!,
          deletedAt: null,
          name: { equals: record.name, mode: "insensitive" },
        },
      });

      if (duplicate) {
        throw new BadRequestException(
          "Another active tax category with this name already exists.",
        );
      }

      const restored = await tx.taxCategory.update({
        where: { id },
        data: {
          deletedAt: null,
          version: { increment: 1 },
        },
      });

      await this.auditService.log(
        {
          action: "TAX_CATEGORY_RESTORED",
          entity: "TaxCategory",
          entityId: id,
          newValues: {
            name: record.name,
            restoredId: id,
          },
        },
        tx,
      );

      return restored;
    });
  }
}
