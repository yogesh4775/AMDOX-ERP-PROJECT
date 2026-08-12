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
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { UpdateDepartmentDto } from "./dto/update-department.dto";
import { QueryDepartmentDto } from "./dto/query-department.dto";
import { DeleteDepartmentDto } from "./dto/delete-department.dto";
import { RestoreDepartmentDto } from "./dto/restore-department.dto";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";
import { Prisma } from "@amdox/database/generated";

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly transactionHelper: TransactionHelper,
    private readonly dependencyRegistry: MasterDependencyRegistry,
  ) {}

  async create(dto: CreateDepartmentDto, user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    const normalized = normalizeName(dto.name);

    return this.transactionHelper.run(async (tx) => {
      // Case-insensitive active duplicate check
      const existing = await tx.department.findFirst({
        where: {
          tenantId: user.tenantId!,
          deletedAt: null,
          name: { equals: normalized, mode: "insensitive" },
        },
      });

      if (existing) {
        throw new BadRequestException(
          "A department with this name already exists.",
        );
      }

      const record = await tx.department.create({
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
          action: "DEPARTMENT_CREATED",
          entity: "Department",
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

  async findAll(query: QueryDepartmentDto, user: AuthUser) {
    const where: Prisma.DepartmentWhereInput = {
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
      this.prisma.department.count({ where }),
      this.prisma.department.findMany({
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
    const record = await this.prisma.department.findUnique({
      where: { id },
    });

    if (!record || record.deletedAt) {
      throw new NotFoundException("Department not found");
    }

    if (record.tenantId !== user.tenantId) {
      throw new ForbiddenException("Access denied.");
    }

    return record;
  }

  async update(id: string, dto: UpdateDepartmentDto, user: AuthUser) {
    return this.transactionHelper.run(async (tx) => {
      const record = await tx.department.findUnique({
        where: { id },
      });

      if (!record || record.deletedAt) {
        throw new NotFoundException("Department not found");
      }

      if (record.tenantId !== user.tenantId) {
        throw new ForbiddenException("Access denied.");
      }

      if (record.version !== dto.expectedVersion) {
        throw new ConflictException(
          "Concurrent modification error: Version mismatch",
        );
      }

      const updateData: Prisma.DepartmentUpdateInput = {};

      if (dto.name !== undefined) {
        const normalized = normalizeName(dto.name);
        if (normalized.toLowerCase() !== record.name.toLowerCase()) {
          const duplicate = await tx.department.findFirst({
            where: {
              tenantId: user.tenantId!,
              deletedAt: null,
              name: { equals: normalized, mode: "insensitive" },
            },
          });
          if (duplicate) {
            throw new BadRequestException(
              "A department with this name already exists.",
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

      const updated = await tx.department.update({
        where: { id },
        data: updateData,
      });

      await this.auditService.log(
        {
          action: "DEPARTMENT_UPDATED",
          entity: "Department",
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

  async delete(id: string, dto: DeleteDepartmentDto, user: AuthUser) {
    return this.transactionHelper.run(async (tx) => {
      const record = await tx.department.findUnique({
        where: { id },
      });

      if (!record || record.deletedAt) {
        throw new NotFoundException("Department not found");
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

      // Reusable Dependency check
      await this.dependencyRegistry.validateDeletion(
        "Department",
        this.prisma,
        id,
        user.tenantId!,
      );

      const deleted = await tx.department.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          version: { increment: 1 },
        },
      });

      await this.auditService.log(
        {
          action: "DEPARTMENT_DELETED",
          entity: "Department",
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

  async restore(id: string, dto: RestoreDepartmentDto, user: AuthUser) {
    return this.transactionHelper.run(async (tx) => {
      const record = await tx.department.findUnique({
        where: { id },
      });

      if (!record || !record.deletedAt) {
        throw new NotFoundException("Soft-deleted department not found");
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

      // Check active duplicate before restoring
      const duplicate = await tx.department.findFirst({
        where: {
          tenantId: user.tenantId!,
          deletedAt: null,
          name: { equals: record.name, mode: "insensitive" },
        },
      });

      if (duplicate) {
        throw new BadRequestException(
          "Another active department with this name already exists.",
        );
      }

      const restored = await tx.department.update({
        where: { id },
        data: {
          deletedAt: null,
          version: { increment: 1 },
        },
      });

      await this.auditService.log(
        {
          action: "DEPARTMENT_RESTORED",
          entity: "Department",
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
