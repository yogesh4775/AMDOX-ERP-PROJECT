import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { AuditService } from "../../common/audit/audit.service";
import {
  TransactionHelper,
  PrismaTx,
} from "../../common/transactions/transaction.helper";
import { AuthUser } from "../auth/interfaces/auth-user.interface";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";
import { QueryCustomerDto } from "./dto/query-customer.dto";
import { Prisma, Customer, MasterStatus } from "@amdox/database/generated";

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly transactionHelper: TransactionHelper,
  ) {}

  private normalizeName(name: string): string {
    return name.trim().replace(/\s+/g, " ");
  }

  async create(dto: CreateCustomerDto, user: AuthUser): Promise<Customer> {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    const tenantId = user.tenantId!;
    const name = this.normalizeName(dto.name);

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      // Check duplicate active customer
      const duplicate = await tx.customer.findFirst({
        where: {
          tenantId,
          name,
          status: MasterStatus.ACTIVE,
          deletedAt: null,
        },
      });

      if (duplicate) {
        throw new BadRequestException(
          `An active customer with name "${name}" already exists.`,
        );
      }

      const customer = await tx.customer.create({
        data: {
          tenantId,
          name,
          email: dto.email || null,
          phone: dto.phone || null,
          address: dto.address || null,
          status: MasterStatus.ACTIVE,
          version: 1,
        },
      });

      await this.auditService.log(
        {
          action: "CUSTOMER_CREATED",
          entity: "Customer",
          entityId: customer.id,
          newValues: customer,
        },
        tx,
      );

      return customer;
    });
  }

  async findAll(query: QueryCustomerDto, user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = {
      tenantId: user.tenantId!,
      deletedAt: null,
    };

    if (query.name) {
      where.name = {
        contains: query.name,
        mode: "insensitive",
      };
    }

    if (query.email) {
      where.email = {
        contains: query.email,
        mode: "insensitive",
      };
    }

    const sortField = query.sort || "createdAt";
    const order = query.order || "desc";

    const [totalItems, data] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        orderBy: { [sortField]: order },
        skip,
        take: limit,
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

  async findOne(id: string, user: AuthUser): Promise<Customer> {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId: user.tenantId!, deletedAt: null },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found.`);
    }

    return customer;
  }

  async update(
    id: string,
    dto: UpdateCustomerDto,
    user: AuthUser,
  ): Promise<Customer> {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    const tenantId = user.tenantId!;

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const customer = await tx.customer.findFirst({
        where: { id, tenantId, deletedAt: null },
      });

      if (!customer) {
        throw new NotFoundException(`Customer with ID ${id} not found.`);
      }

      if (customer.version !== dto.expectedVersion) {
        throw new ConflictException(
          `Optimistic concurrency lock failed. Expected version: ${customer.version}`,
        );
      }

      const name = dto.name ? this.normalizeName(dto.name) : customer.name;

      if (dto.name) {
        const duplicate = await tx.customer.findFirst({
          where: {
            tenantId,
            name,
            status: MasterStatus.ACTIVE,
            deletedAt: null,
            id: { not: id },
          },
        });

        if (duplicate) {
          throw new BadRequestException(
            `An active customer with name "${name}" already exists.`,
          );
        }
      }

      const updated = await tx.customer.update({
        where: { id },
        data: {
          name,
          email: dto.email !== undefined ? dto.email || null : undefined,
          phone: dto.phone !== undefined ? dto.phone || null : undefined,
          address: dto.address !== undefined ? dto.address || null : undefined,
          version: customer.version + 1,
        },
      });

      await this.auditService.log(
        {
          action: "CUSTOMER_UPDATED",
          entity: "Customer",
          entityId: id,
          oldValues: customer,
          newValues: updated,
        },
        tx,
      );

      return updated;
    });
  }

  async delete(
    id: string,
    expectedVersion: number,
    user: AuthUser,
  ): Promise<Customer> {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const customer = await tx.customer.findFirst({
        where: { id, tenantId: user.tenantId!, deletedAt: null },
      });

      if (!customer) {
        throw new NotFoundException(`Customer with ID ${id} not found.`);
      }

      if (customer.version !== expectedVersion) {
        throw new ConflictException(
          `Optimistic concurrency lock failed. Expected version: ${customer.version}`,
        );
      }

      const updated = await tx.customer.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          status: MasterStatus.INACTIVE,
          version: customer.version + 1,
        },
      });

      await this.auditService.log(
        {
          action: "CUSTOMER_DELETED",
          entity: "Customer",
          entityId: id,
          oldValues: customer,
          newValues: updated,
        },
        tx,
      );

      return updated;
    });
  }

  async restore(
    id: string,
    expectedVersion: number,
    user: AuthUser,
  ): Promise<Customer> {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const customer = await tx.customer.findFirst({
        where: { id, tenantId: user.tenantId!, NOT: { deletedAt: null } },
      });

      if (!customer) {
        throw new NotFoundException(
          `Soft-deleted Customer with ID ${id} not found.`,
        );
      }

      if (customer.version !== expectedVersion) {
        throw new ConflictException(
          `Optimistic concurrency lock failed. Expected version: ${customer.version}`,
        );
      }

      // Check duplicate name on restore
      const duplicate = await tx.customer.findFirst({
        where: {
          tenantId: user.tenantId!,
          name: customer.name,
          status: MasterStatus.ACTIVE,
          deletedAt: null,
        },
      });

      if (duplicate) {
        throw new BadRequestException(
          `An active customer with name "${customer.name}" already exists.`,
        );
      }

      const updated = await tx.customer.update({
        where: { id },
        data: {
          deletedAt: null,
          status: MasterStatus.ACTIVE,
          version: customer.version + 1,
        },
      });

      await this.auditService.log(
        {
          action: "CUSTOMER_RESTORED",
          entity: "Customer",
          entityId: id,
          oldValues: customer,
          newValues: updated,
        },
        tx,
      );

      return updated;
    });
  }
}
