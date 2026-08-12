import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { AuditService } from "../../../common/audit/audit.service";
import { CreateWorkOrderDto } from "../dto/create-work-order.dto";
import { LogOperationDto } from "../dto/log-operation.dto";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";
import {
  WorkOrderStatus,
  OperationStatus,
  StockTransactionType,
  JournalSourceType,
  AccountType,
  AccountStatus,
  Prisma,
} from "@amdox/database/generated";
import { StockService } from "../../inventory/stock.service";
import { AccountingService } from "../../accounting/accounting.service";
import { ModuleRef } from "@nestjs/core";
import { PrismaTx } from "../../../common/transactions/transaction.helper";

@Injectable()
export class WorkOrderService {
  private readonly logger = new Logger(WorkOrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly stockService: StockService,
    private readonly accountingService: AccountingService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async create(dto: CreateWorkOrderDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    // Check duplicate code
    const existing = await this.prisma.workOrder.findFirst({
      where: { tenantId, code: dto.code, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException(
        `Work Order with code ${dto.code} already exists.`,
      );
    }

    // Verify product, BOM, Routing
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, tenantId, deletedAt: null },
    });
    if (!product) {
      throw new NotFoundException(`Product not found.`);
    }

    const bom = await this.prisma.bOM.findFirst({
      where: { id: dto.bomId, tenantId, deletedAt: null },
    });
    if (!bom) {
      throw new NotFoundException(`BOM not found.`);
    }

    const routing = await this.prisma.routing.findFirst({
      where: { id: dto.routingId, tenantId, deletedAt: null },
      include: { operations: true },
    });
    if (!routing) {
      throw new NotFoundException(`Routing not found.`);
    }

    // Create Work Order and copy operations
    const wo = await this.prisma.workOrder.create({
      data: {
        tenantId,
        code: dto.code,
        bomId: dto.bomId,
        routingId: dto.routingId,
        productId: dto.productId,
        quantity: dto.quantity,
        plannedStartDate: new Date(dto.plannedStartDate),
        plannedEndDate: new Date(dto.plannedEndDate),
        status: WorkOrderStatus.DRAFT,
        initiatedById: user.id,
        operations: {
          create: routing.operations.map((op) => ({
            tenantId,
            sequence: op.sequence,
            name: op.name,
            workCenterId: op.workCenterId,
            setupTimeMinutes: op.setupTimeMinutes,
            executionTimeMinutes: op.executionTimeMinutes,
            status: OperationStatus.PENDING,
          })),
        },
      },
      include: {
        operations: true,
      },
    });

    await this.auditService.log({
      action: "WORK_ORDER_CREATED",
      entity: "WorkOrder",
      entityId: wo.id,
      newValues: wo as unknown as Record<string, unknown>,
    });

    return wo;
  }

  async findAll(user: AuthUser) {
    return this.prisma.workOrder.findMany({
      where: { tenantId: user.tenantId!, deletedAt: null },
      include: {
        product: true,
        bom: true,
        routing: true,
        operations: {
          include: {
            workCenter: true,
          },
        },
      },
    });
  }

  async findOne(id: string, user: AuthUser) {
    const wo = await this.prisma.workOrder.findFirst({
      where: { id, tenantId: user.tenantId!, deletedAt: null },
      include: {
        product: true,
        bom: {
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        },
        routing: true,
        operations: {
          include: {
            workCenter: true,
          },
        },
      },
    });
    if (!wo) {
      throw new NotFoundException(`Work Order not found.`);
    }
    return wo;
  }

  async submit(id: string, user: AuthUser) {
    const tenantId = user.tenantId!;
    const wo = await this.findOne(id, user);

    if (wo.status !== WorkOrderStatus.DRAFT) {
      throw new BadRequestException(
        "Work Order can only be submitted in DRAFT status.",
      );
    }

    let workflowInstanceId: string | undefined;
    try {
      const workflowService = this.moduleRef.get("WorkflowService", {
        strict: false,
      });
      if (workflowService) {
        const def = await this.prisma.workflowDefinition.findFirst({
          where: {
            tenantId,
            code: "WORK_ORDER_APPROVAL",
            isActive: true,
            deletedAt: null,
          },
        });
        if (def) {
          const res = await (
            workflowService as unknown as {
              submitInstance: (
                p: {
                  entityType: string;
                  entityId: string;
                  definitionCode: string;
                },
                u: AuthUser,
              ) => Promise<{ id: string }>;
            }
          ).submitInstance(
            {
              entityType: "WorkOrder",
              entityId: wo.id,
              definitionCode: "WORK_ORDER_APPROVAL",
            },
            user,
          );
          workflowInstanceId = res.id;
        }
      }
    } catch (err) {
      this.logger.warn(
        `Failed to automatically route Work Order to workflow engine: ${err}`,
      );
    }

    const updatedStatus = workflowInstanceId
      ? WorkOrderStatus.PENDING_APPROVAL
      : WorkOrderStatus.APPROVED;

    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: {
        status: updatedStatus,
        version: { increment: 1 },
      },
    });

    await this.auditService.log({
      action: "WORK_ORDER_SUBMITTED",
      entity: "WorkOrder",
      entityId: id,
      newValues: {
        status: updatedStatus,
        workflowInstanceId,
      } as unknown as Record<string, unknown>,
    });

    return updated;
  }

  async start(id: string, user: AuthUser) {
    const tenantId = user.tenantId!;
    const wo = await this.findOne(id, user);

    if (wo.status !== WorkOrderStatus.APPROVED) {
      throw new BadRequestException(
        "Work Order must be APPROVED before starting.",
      );
    }

    // Find a warehouse
    let warehouse = await this.prisma.warehouse.findFirst({
      where: { tenantId, deletedAt: null },
    });
    if (!warehouse) {
      warehouse = await this.prisma.warehouse.create({
        data: {
          tenantId,
          code: "MAIN",
          name: "Main Warehouse",
        },
      });
    }

    // Material reservation & consumption logic
    await this.prisma.$transaction(async (tx) => {
      for (const item of wo.bom.items) {
        const qtyToConsume =
          Number(item.quantity) *
          Number(wo.quantity) *
          (1 + Number(item.scrapFactor) / 100);

        // Check stock availability
        const stock = await tx.stock.findFirst({
          where: {
            tenantId,
            productId: item.productId,
            warehouseId: warehouse.id,
          },
        });

        if (!stock || Number(stock.quantity) < qtyToConsume) {
          throw new BadRequestException(
            `Insufficient stock for raw material product ${item.product.name}. Required: ${qtyToConsume}, Available: ${stock ? stock.quantity : 0}`,
          );
        }

        // Consume stock
        await this.stockService.mutateStock(
          tx as unknown as Prisma.TransactionClient,
          tenantId,
          warehouse.id,
          item.productId,
          StockTransactionType.STOCK_OUT,
          -qtyToConsume,
          "WorkOrder",
          wo.id,
          user.id,
          `Material consumption for Work Order ${wo.code}`,
        );
      }

      // Transition Work Center capacity & check work center status
      for (const op of wo.operations) {
        if (op.workCenter.status !== "ACTIVE") {
          throw new BadRequestException(
            `Work Center ${op.workCenter.name} is not ACTIVE.`,
          );
        }
      }

      // Update WO status
      await tx.workOrder.update({
        where: { id },
        data: {
          status: WorkOrderStatus.IN_PROGRESS,
          actualStartDate: new Date(),
          version: { increment: 1 },
        },
      });
    });

    const updated = await this.findOne(id, user);

    await this.auditService.log({
      action: "WORK_ORDER_STARTED",
      entity: "WorkOrder",
      entityId: id,
      newValues: { status: WorkOrderStatus.IN_PROGRESS } as unknown as Record<
        string,
        unknown
      >,
    });

    return updated;
  }

  async logOperation(
    woId: string,
    seq: number,
    dto: LogOperationDto,
    user: AuthUser,
  ) {
    const wo = await this.findOne(woId, user);
    if (wo.status !== WorkOrderStatus.IN_PROGRESS) {
      throw new BadRequestException(
        "Can only log operations for Work Orders in progress.",
      );
    }

    const op = wo.operations.find((o) => o.sequence === seq);
    if (!op) {
      throw new NotFoundException(`Operation with sequence ${seq} not found.`);
    }

    const updatedOp = await this.prisma.workOrderOperation.update({
      where: { id: op.id },
      data: {
        actualSetupTimeMinutes: dto.actualSetupTimeMinutes,
        actualExecutionTimeMinutes: dto.actualExecutionTimeMinutes,
        status: OperationStatus.COMPLETED,
        version: { increment: 1 },
      },
    });

    await this.auditService.log({
      action: "WORK_ORDER_OPERATION_LOGGED",
      entity: "WorkOrderOperation",
      entityId: op.id,
      newValues: updatedOp as unknown as Record<string, unknown>,
    });

    return updatedOp;
  }

  async complete(id: string, user: AuthUser) {
    const tenantId = user.tenantId!;
    const wo = await this.findOne(id, user);

    if (wo.status !== WorkOrderStatus.IN_PROGRESS) {
      throw new BadRequestException(
        "Work Order must be IN_PROGRESS to complete.",
      );
    }

    // Verify all operations are completed
    const pendingOp = wo.operations.find(
      (o) => o.status !== OperationStatus.COMPLETED,
    );
    if (pendingOp) {
      throw new BadRequestException(
        `Cannot complete Work Order. Operation ${pendingOp.name} is not completed.`,
      );
    }

    // Get warehouse
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { tenantId, deletedAt: null },
    });
    if (!warehouse) {
      throw new NotFoundException("Warehouse not found.");
    }

    // Calculate costing
    let materialCost = 0;
    for (const item of wo.bom.items) {
      const qtyToConsume =
        Number(item.quantity) *
        Number(wo.quantity) *
        (1 + Number(item.scrapFactor) / 100);
      const rawProduct = await this.prisma.product.findFirst({
        where: { id: item.productId, tenantId },
      });
      materialCost += qtyToConsume * Number(rawProduct?.costPrice || 0);
    }

    let laborCost = 0;
    for (const op of wo.operations) {
      const runTime =
        Number(op.actualSetupTimeMinutes || 0) +
        Number(op.actualExecutionTimeMinutes || 0);
      laborCost += (runTime / 60) * Number(op.workCenter.overheadRate || 0);
    }

    const totalCost = materialCost + laborCost;

    await this.prisma.$transaction(async (tx) => {
      // Produce Finished Goods Stock
      await this.stockService.mutateStock(
        tx as unknown as Prisma.TransactionClient,
        tenantId,
        warehouse.id,
        wo.productId,
        StockTransactionType.STOCK_IN,
        Number(wo.quantity),
        "WorkOrder",
        wo.id,
        user.id,
        `Production output for Work Order ${wo.code}`,
      );

      // Create ledger accounts if missing
      const wipAcc = await tx.account.findFirst({
        where: { tenantId, code: "1410", deletedAt: null },
      });
      if (!wipAcc) {
        await tx.account.create({
          data: {
            tenantId,
            code: "1410",
            name: "Work In Progress (WIP)",
            type: AccountType.ASSET,
            status: AccountStatus.ACTIVE,
          },
        });
      }

      const absAcc = await tx.account.findFirst({
        where: { tenantId, code: "5200", deletedAt: null },
      });
      if (!absAcc) {
        await tx.account.create({
          data: {
            tenantId,
            code: "5200",
            name: "Overhead Cost Absorption",
            type: AccountType.EXPENSE,
            status: AccountStatus.ACTIVE,
          },
        });
      }

      // Post Journal Entry via Accounting Integration
      if (totalCost > 0) {
        const journalLines = [
          { code: "1400", debit: totalCost, credit: 0 }, // Debit Inventory (Finished Goods)
          { code: "1410", debit: 0, credit: materialCost }, // Credit WIP (Materials)
          { code: "5200", debit: 0, credit: laborCost }, // Credit Labor/Overhead Absorption
        ];

        // Filter out zero value lines to satisfy accounting balancing constraints
        const activeLines = journalLines.filter(
          (l) => l.debit > 0 || l.credit > 0,
        );

        if (activeLines.length > 0) {
          await this.accountingService.automatedPost(
            tx as unknown as PrismaTx,
            JournalSourceType.STOCK_MOVEMENT,
            wo.id,
            `Manufacturing valuation for Work Order ${wo.code}`,
            activeLines,
            { id: user.id, tenantId },
          );
        }
      }

      // Update WO status
      await tx.workOrder.update({
        where: { id },
        data: {
          status: WorkOrderStatus.COMPLETED,
          actualEndDate: new Date(),
          version: { increment: 1 },
        },
      });
    });

    const updated = await this.findOne(id, user);

    await this.auditService.log({
      action: "WORK_ORDER_COMPLETED",
      entity: "WorkOrder",
      entityId: id,
      newValues: {
        status: WorkOrderStatus.COMPLETED,
        materialCost,
        laborCost,
        totalCost,
      } as unknown as Record<string, unknown>,
    });

    return updated;
  }

  async cancel(id: string, user: AuthUser) {
    const wo = await this.findOne(id, user);
    if (
      wo.status === WorkOrderStatus.COMPLETED ||
      wo.status === WorkOrderStatus.CANCELLED
    ) {
      throw new BadRequestException(
        "Cannot cancel completed or already cancelled Work Orders.",
      );
    }

    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: {
        status: WorkOrderStatus.CANCELLED,
        version: { increment: 1 },
      },
    });

    await this.auditService.log({
      action: "WORK_ORDER_CANCELLED",
      entity: "WorkOrder",
      entityId: id,
      newValues: { status: WorkOrderStatus.CANCELLED } as unknown as Record<
        string,
        unknown
      >,
    });

    return updated;
  }
}
