import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { TransactionHelper } from "../../common/transactions/transaction.helper";
import { AuditService } from "../../common/audit/audit.service";
import { normalizeName } from "../master-data/master-data.helper";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { QueryProductDto } from "./dto/query-product.dto";
import { AuthUser } from "../auth/interfaces/auth-user.interface";
import { Prisma, MasterStatus } from "@amdox/database/generated";

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly transactionHelper: TransactionHelper,
  ) {}

  private normalizeSku(sku: string): string {
    if (!sku) return "";
    return sku.trim().replace(/\s+/g, " ");
  }

  private normalizeBarcode(barcode?: string): string | null {
    if (!barcode) return null;
    return barcode.trim().replace(/\s+/g, " ");
  }

  async create(dto: CreateProductDto, user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    const normalizedName = normalizeName(dto.name);
    const normalizedSku = this.normalizeSku(dto.sku);
    const normalizedBarcode = this.normalizeBarcode(dto.barcode);

    return this.transactionHelper.run(async (tx) => {
      // Validate Category, Unit, TaxCategory belong to tenant and exist
      const category = await tx.category.findFirst({
        where: {
          id: dto.categoryId,
          tenantId: user.tenantId!,
          deletedAt: null,
        },
      });
      if (!category) {
        throw new BadRequestException("Category not found or inactive.");
      }

      const unit = await tx.unit.findFirst({
        where: { id: dto.unitId, tenantId: user.tenantId!, deletedAt: null },
      });
      if (!unit) {
        throw new BadRequestException("Unit not found or inactive.");
      }

      if (dto.taxCategoryId) {
        const taxCategory = await tx.taxCategory.findFirst({
          where: {
            id: dto.taxCategoryId,
            tenantId: user.tenantId!,
            deletedAt: null,
          },
        });
        if (!taxCategory) {
          throw new BadRequestException("Tax category not found or inactive.");
        }
      }

      // Check case-insensitive duplicate SKU
      const existingSku = await tx.product.findFirst({
        where: {
          tenantId: user.tenantId!,
          deletedAt: null,
          sku: { equals: normalizedSku, mode: "insensitive" },
        },
      });
      if (existingSku) {
        throw new BadRequestException(
          "A product with this SKU already exists.",
        );
      }

      // Check case-insensitive duplicate Barcode
      if (normalizedBarcode) {
        const existingBarcode = await tx.product.findFirst({
          where: {
            tenantId: user.tenantId!,
            deletedAt: null,
            barcode: { equals: normalizedBarcode, mode: "insensitive" },
          },
        });
        if (existingBarcode) {
          throw new BadRequestException(
            "A product with this Barcode already exists.",
          );
        }
      }

      // Create Product
      const product = await tx.product.create({
        data: {
          tenantId: user.tenantId!,
          name: normalizedName,
          sku: normalizedSku,
          barcode: normalizedBarcode,
          description: dto.description || null,
          categoryId: dto.categoryId,
          unitId: dto.unitId,
          taxCategoryId: dto.taxCategoryId || null,
          costPrice: dto.costPrice || 0,
          salePrice: dto.salePrice || 0,
          reorderLevel: dto.reorderLevel || 0,
          reorderQuantity: dto.reorderQuantity || 0,
          status: dto.status || MasterStatus.ACTIVE,
          version: 1,
        },
      });

      // Audit Log
      await this.auditService.log({
        tenantId: user.tenantId!,
        userId: user.id,
        entity: "Product",
        entityId: product.id,
        action: "PRODUCT_CREATED",
        oldValues: null,
        newValues: product,
      });

      return product;
    });
  }

  async findAll(query: QueryProductDto, user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      tenantId: user.tenantId!,
      deletedAt: query.includeDeleted ? undefined : null,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { sku: { contains: query.search, mode: "insensitive" } },
        { barcode: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const sortField = query.sort || "createdAt";
    const order = query.order || "desc";

    const [totalItems, data] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: { [sortField]: order },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          sku: true,
          barcode: true,
          description: true,
          categoryId: true,
          unitId: true,
          taxCategoryId: true,
          costPrice: true,
          salePrice: true,
          reorderLevel: true,
          reorderQuantity: true,
          status: true,
          version: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
        },
      }),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return {
      data,
      meta: {
        total: totalItems,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(id: string, user: AuthUser) {
    const record = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!record || record.deletedAt) {
      throw new NotFoundException("Product not found");
    }

    if (record.tenantId !== user.tenantId) {
      throw new ForbiddenException("Access denied.");
    }

    return record;
  }

  async update(id: string, dto: UpdateProductDto, user: AuthUser) {
    return this.transactionHelper.run(async (tx) => {
      const record = await tx.product.findUnique({
        where: { id },
      });

      if (!record || record.deletedAt) {
        throw new NotFoundException("Product not found");
      }

      if (record.tenantId !== user.tenantId) {
        throw new ForbiddenException("Access denied.");
      }

      if (record.version !== dto.expectedVersion) {
        throw new ConflictException(
          "Concurrent modification error: Version mismatch",
        );
      }

      const updateData: Prisma.ProductUpdateInput = {};

      if (dto.categoryId !== undefined) {
        const category = await tx.category.findFirst({
          where: {
            id: dto.categoryId,
            tenantId: user.tenantId!,
            deletedAt: null,
          },
        });
        if (!category) {
          throw new BadRequestException("Category not found or inactive.");
        }
        updateData.category = { connect: { id: dto.categoryId } };
      }

      if (dto.unitId !== undefined) {
        const unit = await tx.unit.findFirst({
          where: { id: dto.unitId, tenantId: user.tenantId!, deletedAt: null },
        });
        if (!unit) {
          throw new BadRequestException("Unit not found or inactive.");
        }
        updateData.unit = { connect: { id: dto.unitId } };
      }

      if (dto.taxCategoryId !== undefined) {
        if (dto.taxCategoryId) {
          const taxCategory = await tx.taxCategory.findFirst({
            where: {
              id: dto.taxCategoryId,
              tenantId: user.tenantId!,
              deletedAt: null,
            },
          });
          if (!taxCategory) {
            throw new BadRequestException(
              "Tax category not found or inactive.",
            );
          }
          updateData.taxCategory = { connect: { id: dto.taxCategoryId } };
        } else {
          updateData.taxCategory = { disconnect: true };
        }
      }

      if (dto.name !== undefined) {
        updateData.name = normalizeName(dto.name);
      }

      if (dto.sku !== undefined) {
        const normalizedSku = this.normalizeSku(dto.sku);
        if (normalizedSku.toLowerCase() !== record.sku.toLowerCase()) {
          const existingSku = await tx.product.findFirst({
            where: {
              tenantId: user.tenantId!,
              deletedAt: null,
              sku: { equals: normalizedSku, mode: "insensitive" },
            },
          });
          if (existingSku) {
            throw new BadRequestException(
              "A product with this SKU already exists.",
            );
          }
        }
        updateData.sku = normalizedSku;
      }

      if (dto.barcode !== undefined) {
        const normalizedBarcode = this.normalizeBarcode(dto.barcode);
        if (normalizedBarcode !== record.barcode) {
          if (normalizedBarcode) {
            const existingBarcode = await tx.product.findFirst({
              where: {
                tenantId: user.tenantId!,
                deletedAt: null,
                barcode: { equals: normalizedBarcode, mode: "insensitive" },
              },
            });
            if (existingBarcode) {
              throw new BadRequestException(
                "A product with this Barcode already exists.",
              );
            }
          }
        }
        updateData.barcode = normalizedBarcode;
      }

      if (dto.description !== undefined) {
        updateData.description = dto.description || null;
      }

      if (dto.costPrice !== undefined) {
        updateData.costPrice = dto.costPrice;
      }

      if (dto.salePrice !== undefined) {
        updateData.salePrice = dto.salePrice;
      }

      if (dto.reorderLevel !== undefined) {
        updateData.reorderLevel = dto.reorderLevel;
      }

      if (dto.reorderQuantity !== undefined) {
        updateData.reorderQuantity = dto.reorderQuantity;
      }

      if (dto.status !== undefined) {
        updateData.status = dto.status;
      }

      updateData.version = { increment: 1 };

      const updated = await tx.product.update({
        where: { id },
        data: updateData,
      });

      await this.auditService.log({
        tenantId: user.tenantId!,
        userId: user.id,
        entity: "Product",
        entityId: id,
        action: "PRODUCT_UPDATED",
        oldValues: record,
        newValues: updated,
      });

      return updated;
    });
  }

  async delete(id: string, expectedVersion: number, user: AuthUser) {
    return this.transactionHelper.run(async (tx) => {
      const record = await tx.product.findUnique({
        where: { id },
      });

      if (!record || record.deletedAt) {
        throw new NotFoundException("Product not found");
      }

      if (record.tenantId !== user.tenantId) {
        throw new ForbiddenException("Access denied.");
      }

      if (record.version !== expectedVersion) {
        throw new ConflictException(
          "Concurrent modification error: Version mismatch",
        );
      }

      const updated = await tx.product.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          version: { increment: 1 },
        },
      });

      await this.auditService.log({
        tenantId: user.tenantId!,
        userId: user.id,
        entity: "Product",
        entityId: id,
        action: "PRODUCT_DELETED",
        oldValues: record,
        newValues: updated,
      });

      return updated;
    });
  }

  async restore(id: string, expectedVersion: number, user: AuthUser) {
    return this.transactionHelper.run(async (tx) => {
      const record = await tx.product.findUnique({
        where: { id },
      });

      if (!record || !record.deletedAt) {
        throw new NotFoundException("Soft-deleted product not found");
      }

      if (record.tenantId !== user.tenantId) {
        throw new ForbiddenException("Access denied.");
      }

      if (record.version !== expectedVersion) {
        throw new ConflictException(
          "Concurrent modification error: Version mismatch",
        );
      }

      // Check SKU or Barcode conflicts with active products
      const existingSku = await tx.product.findFirst({
        where: {
          tenantId: user.tenantId!,
          deletedAt: null,
          sku: { equals: record.sku, mode: "insensitive" },
        },
      });
      if (existingSku) {
        throw new BadRequestException(
          "Cannot restore product: An active product already uses this SKU.",
        );
      }

      if (record.barcode) {
        const existingBarcode = await tx.product.findFirst({
          where: {
            tenantId: user.tenantId!,
            deletedAt: null,
            barcode: { equals: record.barcode, mode: "insensitive" },
          },
        });
        if (existingBarcode) {
          throw new BadRequestException(
            "Cannot restore product: An active product already uses this Barcode.",
          );
        }
      }

      const updated = await tx.product.update({
        where: { id },
        data: {
          deletedAt: null,
          version: { increment: 1 },
        },
      });

      await this.auditService.log({
        tenantId: user.tenantId!,
        userId: user.id,
        entity: "Product",
        entityId: id,
        action: "PRODUCT_RESTORED",
        oldValues: record,
        newValues: updated,
      });

      return updated;
    });
  }
}
