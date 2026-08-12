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
import { CreateDesignationDto } from "./dto/create-designation.dto";
import { UpdateDesignationDto } from "./dto/update-designation.dto";
import { QueryDesignationDto } from "./dto/query-designation.dto";
import { DeleteDesignationDto } from "./dto/delete-designation.dto";
import { RestoreDesignationDto } from "./dto/restore-designation.dto";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";
import { Prisma } from "@amdox/database/generated";

@Injectable()
export class DesignationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly transactionHelper: TransactionHelper,
    private readonly dependencyRegistry: MasterDependencyRegistry,
  ) {}

  async create(dto: CreateDesignationDto, user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    const normalized = normalizeName(dto.name);

    return this.transactionHelper.run(async (tx) => {
      const existing = await tx.designation.findFirst({
        where: {
          tenantId: user.tenantId!,
          deletedAt: null,
          name: { equals: normalized, mode: "insensitive" },
        },
      });

      if (existing) {
        throw new BadRequestException(
          "A designation with this name already exists.",
        );
      }

      const record = await tx.designation.create({
        data: {
          tenantId: user.tenantId!,
          name: normalized,
          code: dto.code || null,
          description: dto.description || null,
          status: dto.status || "ACTIVE",
        },
      });

      await this.auditService.log(
        {
          action: "DESIGNATION_CREATED",
          entity: "Designation",
          entityId: record.id,
          newValues: {
            id: record.id,
            name: record.name,
            code: record.code,
            status: record.status,
          },
        },
        tx,
      );

      return record;
    });
  }

  async findAll(query: QueryDesignationDto, user: AuthUser) {
    const where: Prisma.DesignationWhereInput = {
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
      this.prisma.designation.count({ where }),
      this.prisma.designation.findMany({
        where,
        orderBy: { [sortField]: order },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          tenantId: true,
          name: true,
          code: true,
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
    const record = await this.prisma.designation.findUnique({
      where: { id },
    });

    if (!record || record.deletedAt) {
      throw new NotFoundException("Designation not found");
    }

    if (record.tenantId !== user.tenantId) {
      throw new ForbiddenException("Access denied.");
    }

    return record;
  }

  async update(id: string, dto: UpdateDesignationDto, user: AuthUser) {
    return this.transactionHelper.run(async (tx) => {
      const record = await tx.designation.findUnique({
        where: { id },
      });

      if (!record || record.deletedAt) {
        throw new NotFoundException("Designation not found");
      }

      if (record.tenantId !== user.tenantId) {
        throw new ForbiddenException("Access denied.");
      }

      if (record.version !== dto.expectedVersion) {
        throw new ConflictException(
          "Concurrent modification error: Version mismatch",
        );
      }

      const updateData: Prisma.DesignationUpdateInput = {};

      if (dto.name !== undefined) {
        const normalized = normalizeName(dto.name);
        if (normalized.toLowerCase() !== record.name.toLowerCase()) {
          const duplicate = await tx.designation.findFirst({
            where: {
              tenantId: user.tenantId!,
              deletedAt: null,
              name: { equals: normalized, mode: "insensitive" },
            },
          });
          if (duplicate) {
            throw new BadRequestException(
              "A designation with this name already exists.",
            );
          }
        }
        updateData.name = normalized;
      }

      if (dto.code !== undefined) {
        updateData.code = dto.code || null;
      }

      if (dto.description !== undefined) {
        updateData.description = dto.description || null;
      }

      if (dto.status !== undefined) {
        updateData.status = dto.status;
      }

      updateData.version = { increment: 1 };

      const updated = await tx.designation.update({
        where: { id },
        data: updateData,
      });

      await this.auditService.log(
        {
          action: "DESIGNATION_UPDATED",
          entity: "Designation",
          entityId: id,
          oldValues: {
            name: record.name,
            code: record.code,
            status: record.status,
          },
          newValues: {
            name: updated.name,
            code: updated.code,
            status: updated.status,
          },
        },
        tx,
      );

      return updated;
    });
  }

  async delete(id: string, dto: DeleteDesignationDto, user: AuthUser) {
    return this.transactionHelper.run(async (tx) => {
      const record = await tx.designation.findUnique({
        where: { id },
      });

      if (!record || record.deletedAt) {
        throw new NotFoundException("Designation not found");
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
        "Designation",
        this.prisma,
        id,
        user.tenantId!,
      );

      const deleted = await tx.designation.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          version: { increment: 1 },
        },
      });

      await this.auditService.log(
        {
          action: "DESIGNATION_DELETED",
          entity: "Designation",
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

  async restore(id: string, dto: RestoreDesignationDto, user: AuthUser) {
    return this.transactionHelper.run(async (tx) => {
      const record = await tx.designation.findUnique({
        where: { id },
      });

      if (!record || !record.deletedAt) {
        throw new NotFoundException("Soft-deleted designation not found");
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

      const duplicate = await tx.designation.findFirst({
        where: {
          tenantId: user.tenantId!,
          deletedAt: null,
          name: { equals: record.name, mode: "insensitive" },
        },
      });

      if (duplicate) {
        throw new BadRequestException(
          "Another active designation with this name already exists.",
        );
      }

      const restored = await tx.designation.update({
        where: { id },
        data: {
          deletedAt: null,
          version: { increment: 1 },
        },
      });

      await this.auditService.log(
        {
          action: "DESIGNATION_RESTORED",
          entity: "Designation",
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
