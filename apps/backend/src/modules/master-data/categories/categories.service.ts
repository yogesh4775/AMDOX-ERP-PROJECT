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
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { QueryCategoryDto } from "./dto/query-category.dto";
import { DeleteCategoryDto } from "./dto/delete-category.dto";
import { RestoreCategoryDto } from "./dto/restore-category.dto";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";
import { Prisma } from "@amdox/database/generated";

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly transactionHelper: TransactionHelper,
    private readonly dependencyRegistry: MasterDependencyRegistry,
  ) {}

  async create(dto: CreateCategoryDto, user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    const normalized = normalizeName(dto.name);

    return this.transactionHelper.run(async (tx) => {
      const existing = await tx.category.findFirst({
        where: {
          tenantId: user.tenantId!,
          deletedAt: null,
          name: { equals: normalized, mode: "insensitive" },
        },
      });

      if (existing) {
        throw new BadRequestException(
          "A category with this name already exists.",
        );
      }

      if (dto.parentCategoryId) {
        const parent = await tx.category.findFirst({
          where: {
            id: dto.parentCategoryId,
            tenantId: user.tenantId!,
            deletedAt: null,
          },
        });
        if (!parent) {
          throw new BadRequestException(
            "Parent category not found or inactive.",
          );
        }
      }

      const record = await tx.category.create({
        data: {
          tenantId: user.tenantId!,
          name: normalized,
          description: dto.description || null,
          status: dto.status || "ACTIVE",
          parentCategoryId: dto.parentCategoryId || null,
        },
      });

      await this.auditService.log(
        {
          action: "CATEGORY_CREATED",
          entity: "Category",
          entityId: record.id,
          newValues: {
            id: record.id,
            name: record.name,
            status: record.status,
            parentCategoryId: record.parentCategoryId,
          },
        },
        tx,
      );

      return record;
    });
  }

  async findAll(query: QueryCategoryDto, user: AuthUser) {
    const where: Prisma.CategoryWhereInput = {
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
      this.prisma.category.count({ where }),
      this.prisma.category.findMany({
        where,
        orderBy: { [sortField]: order },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          tenantId: true,
          name: true,
          description: true,
          status: true,
          version: true,
          parentCategoryId: true,
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
    const record = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!record || record.deletedAt) {
      throw new NotFoundException("Category not found");
    }

    if (record.tenantId !== user.tenantId) {
      throw new ForbiddenException("Access denied.");
    }

    return record;
  }

  async update(id: string, dto: UpdateCategoryDto, user: AuthUser) {
    return this.transactionHelper.run(async (tx) => {
      const record = await tx.category.findUnique({
        where: { id },
      });

      if (!record || record.deletedAt) {
        throw new NotFoundException("Category not found");
      }

      if (record.tenantId !== user.tenantId) {
        throw new ForbiddenException("Access denied.");
      }

      if (record.version !== dto.expectedVersion) {
        throw new ConflictException(
          "Concurrent modification error: Version mismatch",
        );
      }

      const updateData: Prisma.CategoryUpdateInput = {};

      if (dto.name !== undefined) {
        const normalized = normalizeName(dto.name);
        if (normalized.toLowerCase() !== record.name.toLowerCase()) {
          const duplicate = await tx.category.findFirst({
            where: {
              tenantId: user.tenantId!,
              deletedAt: null,
              name: { equals: normalized, mode: "insensitive" },
            },
          });
          if (duplicate) {
            throw new BadRequestException(
              "A category with this name already exists.",
            );
          }
        }
        updateData.name = normalized;
      }

      if (dto.parentCategoryId !== undefined) {
        if (dto.parentCategoryId) {
          if (dto.parentCategoryId === id) {
            throw new BadRequestException("Category cannot be its own parent.");
          }
          const parent = await tx.category.findFirst({
            where: {
              id: dto.parentCategoryId,
              tenantId: user.tenantId!,
              deletedAt: null,
            },
          });
          if (!parent) {
            throw new BadRequestException(
              "Parent category not found or inactive.",
            );
          }
          updateData.parentCategory = { connect: { id: dto.parentCategoryId } };
        } else {
          updateData.parentCategory = { disconnect: true };
        }
      }

      if (dto.description !== undefined) {
        updateData.description = dto.description || null;
      }

      if (dto.status !== undefined) {
        updateData.status = dto.status;
      }

      updateData.version = { increment: 1 };

      const updated = await tx.category.update({
        where: { id },
        data: updateData,
      });

      await this.auditService.log(
        {
          action: "CATEGORY_UPDATED",
          entity: "Category",
          entityId: id,
          oldValues: {
            name: record.name,
            status: record.status,
            parentCategoryId: record.parentCategoryId,
          },
          newValues: {
            name: updated.name,
            status: updated.status,
            parentCategoryId: updated.parentCategoryId,
          },
        },
        tx,
      );

      return updated;
    });
  }

  async delete(id: string, dto: DeleteCategoryDto, user: AuthUser) {
    return this.transactionHelper.run(async (tx) => {
      const record = await tx.category.findUnique({
        where: { id },
      });

      if (!record || record.deletedAt) {
        throw new NotFoundException("Category not found");
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

      // Check subcategory relations
      const hasSubcategories = await tx.category.count({
        where: { parentCategoryId: id, deletedAt: null },
      });
      if (hasSubcategories > 0) {
        throw new BadRequestException(
          "Cannot delete category as active subcategories exist.",
        );
      }

      await this.dependencyRegistry.validateDeletion(
        "Category",
        this.prisma,
        id,
        user.tenantId!,
      );

      const deleted = await tx.category.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          version: { increment: 1 },
        },
      });

      await this.auditService.log(
        {
          action: "CATEGORY_DELETED",
          entity: "Category",
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

  async restore(id: string, dto: RestoreCategoryDto, user: AuthUser) {
    return this.transactionHelper.run(async (tx) => {
      const record = await tx.category.findUnique({
        where: { id },
      });

      if (!record || !record.deletedAt) {
        throw new NotFoundException("Soft-deleted category not found");
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

      const duplicate = await tx.category.findFirst({
        where: {
          tenantId: user.tenantId!,
          deletedAt: null,
          name: { equals: record.name, mode: "insensitive" },
        },
      });

      if (duplicate) {
        throw new BadRequestException(
          "Another active category with this name already exists.",
        );
      }

      const restored = await tx.category.update({
        where: { id },
        data: {
          deletedAt: null,
          version: { increment: 1 },
        },
      });

      await this.auditService.log(
        {
          action: "CATEGORY_RESTORED",
          entity: "Category",
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
