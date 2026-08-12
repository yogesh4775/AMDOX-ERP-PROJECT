import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { AuditService } from "../../../common/audit/audit.service";
import {
  CreateRoutingDto,
  RoutingOperationDto,
} from "../dto/create-routing.dto";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";

@Injectable()
export class RoutingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateRoutingDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    // Check duplicate code
    const existing = await this.prisma.routing.findFirst({
      where: { tenantId, code: dto.code, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException(
        `Routing with code ${dto.code} already exists.`,
      );
    }

    // Verify finished product exists
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, tenantId, deletedAt: null },
    });
    if (!product) {
      throw new NotFoundException(`Product not found.`);
    }

    // Verify all work centers exist
    for (const op of dto.operations) {
      const wc = await this.prisma.workCenter.findFirst({
        where: { id: op.workCenterId, tenantId, deletedAt: null },
      });
      if (!wc) {
        throw new NotFoundException(
          `Work Center ${op.workCenterId} not found.`,
        );
      }
    }

    // Create Routing and operations
    const routing = await this.prisma.routing.create({
      data: {
        tenantId,
        productId: dto.productId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        operations: {
          create: dto.operations.map((op) => ({
            tenantId,
            workCenterId: op.workCenterId,
            sequence: op.sequence,
            name: op.name,
            description: op.description,
            setupTimeMinutes: op.setupTimeMinutes,
            executionTimeMinutes: op.executionTimeMinutes,
          })),
        },
      },
      include: {
        operations: true,
      },
    });

    await this.auditService.log({
      action: "ROUTING_CREATED",
      entity: "Routing",
      entityId: routing.id,
      newValues: routing as unknown as Record<string, unknown>,
    });

    return routing;
  }

  async findAll(user: AuthUser) {
    return this.prisma.routing.findMany({
      where: { tenantId: user.tenantId!, deletedAt: null },
      include: {
        product: true,
        operations: {
          include: {
            workCenter: true,
          },
        },
      },
    });
  }

  async findOne(id: string, user: AuthUser) {
    const routing = await this.prisma.routing.findFirst({
      where: { id, tenantId: user.tenantId!, deletedAt: null },
      include: {
        product: true,
        operations: {
          include: {
            workCenter: true,
          },
        },
      },
    });
    if (!routing) {
      throw new NotFoundException(`Routing not found.`);
    }
    return routing;
  }

  async update(
    id: string,
    dto: Partial<CreateRoutingDto> & { expectedVersion?: number },
    user: AuthUser,
  ) {
    const tenantId = user.tenantId!;
    const routing = await this.findOne(id, user);

    if (
      dto.expectedVersion !== undefined &&
      routing.version !== dto.expectedVersion
    ) {
      throw new ConflictException(
        "Optimistic lock conflict. Version mismatch.",
      );
    }

    if (dto.code && dto.code !== routing.code) {
      const existing = await this.prisma.routing.findFirst({
        where: { tenantId, code: dto.code, deletedAt: null },
      });
      if (existing) {
        throw new ConflictException(
          `Routing with code ${dto.code} already exists.`,
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.operations) {
        // Clear operations
        await tx.routingOperation.deleteMany({
          where: { routingId: id },
        });

        // Verify work centers
        for (const op of dto.operations) {
          const wc = await tx.workCenter.findFirst({
            where: { id: op.workCenterId, tenantId, deletedAt: null },
          });
          if (!wc) {
            throw new NotFoundException(
              `Work Center ${op.workCenterId} not found.`,
            );
          }
        }
      }

      return tx.routing.update({
        where: { id },
        data: {
          code: dto.code,
          name: dto.name,
          description: dto.description,
          version: { increment: 1 },
          operations: dto.operations
            ? {
                create: dto.operations.map((op: RoutingOperationDto) => ({
                  tenantId,
                  workCenterId: op.workCenterId,
                  sequence: op.sequence,
                  name: op.name,
                  description: op.description,
                  setupTimeMinutes: op.setupTimeMinutes,
                  executionTimeMinutes: op.executionTimeMinutes,
                })),
              }
            : undefined,
        },
        include: {
          operations: true,
        },
      });
    });

    await this.auditService.log({
      action: "ROUTING_UPDATED",
      entity: "Routing",
      entityId: id,
      newValues: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }

  async remove(id: string, user: AuthUser) {
    await this.findOne(id, user);

    const deleted = await this.prisma.routing.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        version: { increment: 1 },
      },
    });

    await this.auditService.log({
      action: "ROUTING_DELETED",
      entity: "Routing",
      entityId: id,
      newValues: { deletedAt: deleted.deletedAt } as unknown as Record<
        string,
        unknown
      >,
    });

    return { success: true };
  }
}
