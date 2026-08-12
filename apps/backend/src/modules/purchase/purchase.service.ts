/* eslint-disable @typescript-eslint/no-explicit-any, no-console */
import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { PrismaService } from "@amdox/database";
import { StockService } from "../inventory/stock.service";
import { AuditService } from "../../common/audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AuthUser } from "../auth/interfaces/auth-user.interface";
import { WorkflowService } from "../workflow/services/workflow.service";
import { CreatePurchaseOrderDto } from "./dto/create-purchase-order.dto";
import { UpdatePurchaseOrderDto } from "./dto/update-purchase-order.dto";
import { ApprovePurchaseOrderDto } from "./dto/approve-purchase-order.dto";
import { ReceivePurchaseOrderDto } from "./dto/receive-purchase-order.dto";
import { CancelPurchaseOrderDto } from "./dto/cancel-purchase-order.dto";
import { QueryPurchaseOrderDto } from "./dto/query-purchase-order.dto";
import {
  TransactionHelper,
  PrismaTx,
} from "../../common/transactions/transaction.helper";
import {
  Prisma,
  PurchaseOrderStatus,
  StockTransactionType,
  PurchaseOrder,
  JournalSourceType,
} from "@amdox/database/generated";
import { NotificationType } from "../notifications/dto/query-notification.dto";
import { AccountingService } from "../accounting/accounting.service";
import { TaxService } from "../tax/tax.service";
import { TaxTransactionSourceType } from "@amdox/database/generated";

@Injectable()
export class PurchaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly transactionHelper: TransactionHelper,
    private readonly accountingService: AccountingService,
    private readonly taxService: TaxService,
    private readonly moduleRef: ModuleRef,
  ) {}

  private normalizeSupplierName(name: string): string {
    return name.trim().replace(/\s+/g, " ");
  }

  private async generateOrderNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PO-${year}-`;

    const lastOrder = await this.prisma.purchaseOrder.findFirst({
      where: {
        tenantId,
        orderNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        orderNumber: "desc",
      },
      select: {
        orderNumber: true,
      },
    });

    let nextSeq = 1;
    if (lastOrder) {
      const parts = lastOrder.orderNumber.split("-");
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }

    return `${prefix}${String(nextSeq).padStart(6, "0")}`;
  }

  async create(dto: CreatePurchaseOrderDto, user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    const tenantId = user.tenantId!;
    const supplierName = this.normalizeSupplierName(dto.supplierName);

    // Calculate totals and check product existence
    const itemsData: {
      productId: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }[] = [];
    let totalAmount = new Prisma.Decimal(0);

    for (const item of dto.items) {
      const product = await this.prisma.product.findFirst({
        where: { id: item.productId, tenantId, deletedAt: null },
      });
      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found.`);
      }

      const totalPrice = Number(item.quantity) * Number(item.unitPrice);
      totalAmount = totalAmount.add(new Prisma.Decimal(totalPrice));

      itemsData.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice,
      });
    }

    let retries = 3;
    let purchaseOrder: PurchaseOrder | null = null;

    while (retries > 0) {
      try {
        const orderNumber = await this.generateOrderNumber(tenantId);
        purchaseOrder = await this.transactionHelper.run(
          async (tx: PrismaTx) => {
            const po = await tx.purchaseOrder.create({
              data: {
                tenantId,
                supplierName,
                orderNumber,
                expectedDeliveryDate: new Date(dto.expectedDeliveryDate),
                notes: dto.notes,
                totalAmount,
                createdBy: user.id,
                status: PurchaseOrderStatus.DRAFT,
                version: 1,
                items: {
                  createMany: {
                    data: itemsData.map((item) => ({
                      tenantId,
                      productId: item.productId,
                      quantity: item.quantity,
                      unitPrice: item.unitPrice,
                      totalPrice: item.totalPrice,
                    })),
                  },
                },
              },
              include: {
                items: true,
              },
            });

            await this.auditService.log(
              {
                action: "PURCHASE_CREATED",
                entity: "PurchaseOrder",
                entityId: po.id,
                newValues: {
                  id: po.id,
                  orderNumber: po.orderNumber,
                  supplierName: po.supplierName,
                  totalAmount: po.totalAmount.toString(),
                },
              },
              tx,
            );

            return po;
          },
        );

        break;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          retries--;
          if (retries === 0) {
            throw new ConflictException(
              "Failed to generate a unique purchase order number.",
            );
          }
        } else {
          throw error;
        }
      }
    }

    return purchaseOrder;
  }

  async findAll(query: QueryPurchaseOrderDto, user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PurchaseOrderWhereInput = {
      tenantId: user.tenantId!,
      deletedAt: null,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.supplierName) {
      where.supplierName = {
        contains: query.supplierName,
        mode: "insensitive",
      };
    }

    if (query.startDate || query.endDate) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (query.startDate) dateFilter.gte = new Date(query.startDate);
      if (query.endDate) dateFilter.lte = new Date(query.endDate);
      where.createdAt = dateFilter;
    }

    const sortField = query.sort || "createdAt";
    const order = query.order || "desc";

    const [totalItems, data] = await Promise.all([
      this.prisma.purchaseOrder.count({ where }),
      this.prisma.purchaseOrder.findMany({
        where,
        orderBy: { [sortField]: order },
        skip,
        take: limit,
        include: {
          items: {
            select: {
              productId: true,
              quantity: true,
              receivedQuantity: true,
              unitPrice: true,
              totalPrice: true,
            },
          },
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
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId: user.tenantId!, deletedAt: null },
      include: {
        items: true,
        receipts: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!po) {
      throw new NotFoundException(`Purchase Order ${id} not found.`);
    }

    return po;
  }

  async update(id: string, dto: UpdatePurchaseOrderDto, user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    const tenantId = user.tenantId!;

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const po = await tx.purchaseOrder.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: { items: true },
      });

      if (!po) {
        throw new NotFoundException(`Purchase Order ${id} not found.`);
      }

      if (po.status !== PurchaseOrderStatus.DRAFT) {
        throw new BadRequestException(
          `Only DRAFT orders can be modified. Current status: ${po.status}`,
        );
      }

      if (po.version !== dto.expectedVersion) {
        throw new ConflictException(
          `Optimistic concurrency lock failed. Expected version: ${po.version}`,
        );
      }

      const supplierName = dto.supplierName
        ? this.normalizeSupplierName(dto.supplierName)
        : po.supplierName;
      const expectedDeliveryDate = dto.expectedDeliveryDate
        ? new Date(dto.expectedDeliveryDate)
        : po.expectedDeliveryDate;
      const notes = dto.notes !== undefined ? dto.notes : po.notes;

      let totalAmount = po.totalAmount;
      if (dto.items) {
        // Drop existing items and recreate
        await tx.purchaseOrderItem.deleteMany({
          where: { purchaseOrderId: id },
        });

        const itemsData: {
          productId: string;
          quantity: number;
          unitPrice: number;
          totalPrice: number;
        }[] = [];
        let newTotal = new Prisma.Decimal(0);

        for (const item of dto.items) {
          const product = await tx.product.findFirst({
            where: { id: item.productId, tenantId, deletedAt: null },
          });
          if (!product) {
            throw new NotFoundException(`Product ${item.productId} not found.`);
          }

          const totalPrice = Number(item.quantity) * Number(item.unitPrice);
          newTotal = new Prisma.Decimal(Number(newTotal) + totalPrice);

          itemsData.push({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice,
          });
        }

        await tx.purchaseOrderItem.createMany({
          data: itemsData.map((item) => ({
            tenantId,
            purchaseOrderId: id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          })),
        });

        totalAmount = newTotal;
      }

      const updatedPo = await tx.purchaseOrder.update({
        where: { id },
        data: {
          supplierName,
          expectedDeliveryDate,
          notes,
          totalAmount,
          version: po.version + 1,
          updatedBy: user.id,
        },
        include: {
          items: true,
        },
      });

      await this.auditService.log(
        {
          action: "PURCHASE_UPDATED",
          entity: "PurchaseOrder",
          entityId: po.id,
          oldValues: {
            supplierName: po.supplierName,
            totalAmount: po.totalAmount.toString(),
            version: po.version,
          },
          newValues: {
            supplierName: updatedPo.supplierName,
            totalAmount: updatedPo.totalAmount.toString(),
            version: updatedPo.version,
          },
        },
        tx,
      );

      return updatedPo;
    });
  }

  async approve(id: string, dto: ApprovePurchaseOrderDto, user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const po = await tx.purchaseOrder.findFirst({
        where: { id, tenantId: user.tenantId!, deletedAt: null },
      });

      if (!po) {
        throw new NotFoundException(`Purchase Order ${id} not found.`);
      }

      if (po.status !== PurchaseOrderStatus.DRAFT) {
        throw new BadRequestException(
          `Only DRAFT orders can be approved. Current status: ${po.status}`,
        );
      }

      if (po.version !== dto.expectedVersion) {
        throw new ConflictException(
          `Optimistic concurrency lock failed. Expected version: ${po.version}`,
        );
      }

      // Try to submit to workflow engine
      try {
        const workflowService = this.moduleRef.get(WorkflowService, {
          strict: false,
        });
        if (workflowService) {
          const def = await tx.workflowDefinition.findFirst({
            where: {
              tenantId: user.tenantId!,
              code: "PURCHASE_APPROVAL",
              isActive: true,
              deletedAt: null,
            },
          });
          if (def) {
            await (workflowService as any).submitInstance(
              {
                entityType: "PurchaseOrder",
                entityId: id,
                definitionCode: "PURCHASE_APPROVAL",
              },
              user,
            );
            return po; // Returns PO routed to workflow engine
          }
        }
      } catch (err) {
        console.error(
          "Failed to automatically route purchase order to workflow engine:",
          err,
        );
      }

      const updatedPo = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: PurchaseOrderStatus.APPROVED,
          version: po.version + 1,
          updatedBy: user.id,
        },
      });

      // Audit Log
      await this.auditService.log(
        {
          action: "PURCHASE_APPROVED",
          entity: "PurchaseOrder",
          entityId: id,
          oldValues: { status: po.status, version: po.version },
          newValues: { status: updatedPo.status, version: updatedPo.version },
        },
        tx,
      );

      // Notification
      await this.notificationsService.createInternal({
        userId: po.createdBy,
        tenantId: po.tenantId,
        title: "Purchase Order Approved",
        message: `Your Purchase Order ${po.orderNumber} has been approved.`,
        type: NotificationType.SUCCESS,
      });

      // Record TaxTransactions
      const poItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: id },
        include: { product: true },
      });

      const calcResult = await this.taxService.calculateTax(
        {
          supplierId: undefined,
          jurisdiction: undefined,
          items: poItems.map((item) => ({
            productId: item.productId,
            taxCategoryId: item.product.taxCategoryId || "",
            baseAmount: Number(item.quantity.mul(item.unitPrice)),
          })),
        },
        po.tenantId,
      );

      for (let i = 0; i < poItems.length; i++) {
        const calcItem = calcResult.items[i];
        if (calcItem.taxRuleId) {
          await this.taxService.recordTaxTransaction(
            tx,
            {
              sourceType: TaxTransactionSourceType.PURCHASE,
              sourceId: id,
              taxRuleId: calcItem.taxRuleId,
              baseAmount: new Prisma.Decimal(calcItem.baseAmount),
              taxAmount: new Prisma.Decimal(calcItem.taxAmount),
              rate: new Prisma.Decimal(calcItem.rate),
            },
            po.tenantId,
          );
        }
      }

      return updatedPo;
    });
  }

  async receive(id: string, dto: ReceivePurchaseOrderDto, user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    const tenantId = user.tenantId!;

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      // Deterministic Row Lock: Sort received lines by productId ascending to prevent deadlocks
      const sortedReceiptItems = [...dto.items].sort((a, b) =>
        a.productId.localeCompare(b.productId),
      );

      // Retrieve PO & items
      const po = await tx.purchaseOrder.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: { items: true },
      });

      if (!po) {
        throw new NotFoundException(`Purchase Order ${id} not found.`);
      }

      if (
        po.status !== PurchaseOrderStatus.APPROVED &&
        po.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED
      ) {
        throw new BadRequestException(
          `Cannot receive items on order with status ${po.status}.`,
        );
      }

      if (po.version !== dto.expectedVersion) {
        throw new ConflictException(
          `Optimistic concurrency lock failed. Expected version: ${po.version}`,
        );
      }

      // Verify warehouse exists
      const warehouse = await tx.warehouse.findFirst({
        where: { id: dto.warehouseId, tenantId, deletedAt: null },
      });
      if (!warehouse) {
        throw new NotFoundException(`Warehouse ${dto.warehouseId} not found.`);
      }

      // Create Receipt document
      const receipt = await tx.purchaseReceipt.create({
        data: {
          tenantId,
          purchaseOrderId: id,
          warehouseId: dto.warehouseId,
          receivedBy: user.id,
          remarks: dto.remarks,
        },
      });

      const receiptItemsData: {
        purchaseReceiptId: string;
        tenantId: string;
        productId: string;
        quantityReceived: number;
      }[] = [];

      for (const item of sortedReceiptItems) {
        const poItem = po.items.find(
          (line) => line.productId === item.productId,
        );
        if (!poItem) {
          throw new BadRequestException(
            `Product ${item.productId} is not part of Purchase Order ${po.orderNumber}.`,
          );
        }

        const currentReceived = Number(poItem.receivedQuantity);
        const orderedQty = Number(poItem.quantity);
        const remaining = orderedQty - currentReceived;

        if (item.quantityReceived > remaining) {
          throw new BadRequestException(
            `Quantity received (${item.quantityReceived}) exceeds remaining ordered quantity (${remaining}) for product ${item.productId}.`,
          );
        }

        const newReceivedQty = currentReceived + item.quantityReceived;

        // Update purchase order item received quantity
        await tx.purchaseOrderItem.update({
          where: { id: poItem.id },
          data: {
            receivedQuantity: newReceivedQty,
          },
        });

        // Generate receipt items data
        receiptItemsData.push({
          purchaseReceiptId: receipt.id,
          tenantId,
          productId: item.productId,
          quantityReceived: item.quantityReceived,
        });

        // Relies on StockService to atomically mutate inventory and log movements
        await this.stockService.mutateStock(
          tx as unknown as Prisma.TransactionClient,
          tenantId,
          dto.warehouseId,
          item.productId,
          StockTransactionType.STOCK_IN,
          item.quantityReceived,
          "PurchaseReceipt",
          receipt.id,
          user.id,
          dto.remarks || `Purchase order receipt ${po.orderNumber}`,
        );
      }

      // Create receipt items
      await tx.purchaseReceiptItem.createMany({
        data: receiptItemsData,
      });

      // Determine final status
      const refetchedPoItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: id },
      });

      const isCompleted = refetchedPoItems.every(
        (line) => Number(line.receivedQuantity) === Number(line.quantity),
      );
      const nextStatus = isCompleted
        ? PurchaseOrderStatus.COMPLETED
        : PurchaseOrderStatus.PARTIALLY_RECEIVED;

      const updatedPo = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: nextStatus,
          version: po.version + 1,
          updatedBy: user.id,
        },
      });

      // Audit Log
      await this.auditService.log(
        {
          action: "PURCHASE_RECEIVED",
          entity: "PurchaseOrder",
          entityId: id,
          oldValues: { status: po.status, version: po.version },
          newValues: {
            status: updatedPo.status,
            version: updatedPo.version,
            receiptId: receipt.id,
          },
        },
        tx,
      );

      // Notification
      await this.notificationsService.createInternal({
        userId: po.createdBy,
        tenantId: po.tenantId,
        title: isCompleted
          ? "Purchase Order Completed"
          : "Purchase Order Received",
        message: isCompleted
          ? `Your Purchase Order ${po.orderNumber} is fully received and completed.`
          : `Your Purchase Order ${po.orderNumber} is partially received.`,
        type: isCompleted ? NotificationType.SUCCESS : NotificationType.INFO,
      });

      // Automated GL Posting
      let totalCost = 0;
      for (const item of sortedReceiptItems) {
        const poItem = po.items.find(
          (line) => line.productId === item.productId,
        );
        if (poItem) {
          totalCost += item.quantityReceived * Number(poItem.unitPrice);
        }
      }

      if (totalCost > 0) {
        await this.accountingService.automatedPost(
          tx,
          JournalSourceType.PURCHASE_RECEIPT,
          receipt.id,
          `Inventory receipt: PO ${po.orderNumber}`,
          [
            { code: "1400", debit: totalCost, credit: 0 },
            { code: "2100", debit: 0, credit: totalCost },
          ],
          { id: user.id, tenantId },
        );
      }

      return updatedPo;
    });
  }

  async cancel(id: string, dto: CancelPurchaseOrderDto, user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const po = await tx.purchaseOrder.findFirst({
        where: { id, tenantId: user.tenantId!, deletedAt: null },
      });

      if (!po) {
        throw new NotFoundException(`Purchase Order ${id} not found.`);
      }

      if (
        po.status !== PurchaseOrderStatus.DRAFT &&
        po.status !== PurchaseOrderStatus.APPROVED
      ) {
        throw new BadRequestException(
          `Cannot cancel order in ${po.status} status.`,
        );
      }

      if (po.version !== dto.expectedVersion) {
        throw new ConflictException(
          `Optimistic concurrency lock failed. Expected version: ${po.version}`,
        );
      }

      const updatedPo = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: PurchaseOrderStatus.CANCELLED,
          version: po.version + 1,
          updatedBy: user.id,
        },
      });

      // Audit Log
      await this.auditService.log(
        {
          action: "PURCHASE_CANCELLED",
          entity: "PurchaseOrder",
          entityId: id,
          oldValues: { status: po.status, version: po.version },
          newValues: { status: updatedPo.status, version: updatedPo.version },
        },
        tx,
      );

      // Notification
      await this.notificationsService.createInternal({
        userId: po.createdBy,
        tenantId: po.tenantId,
        title: "Purchase Order Cancelled",
        message: `Your Purchase Order ${po.orderNumber} has been cancelled.`,
        type: NotificationType.WARNING,
      });

      return updatedPo;
    });
  }

  async onWorkflowComplete(
    tx: PrismaTx,
    tenantId: string,
    entityId: string,
    status: string,
    user: AuthUser,
  ) {
    const po = await tx.purchaseOrder.findFirst({
      where: { id: entityId, tenantId, deletedAt: null },
    });
    if (!po) return;

    const finalStatus =
      status === "APPROVED"
        ? PurchaseOrderStatus.APPROVED
        : PurchaseOrderStatus.CANCELLED;

    await tx.purchaseOrder.update({
      where: { id: entityId },
      data: {
        status: finalStatus,
        version: po.version + 1,
        updatedBy: user.id,
      },
    });

    await this.auditService.log(
      {
        action:
          status === "APPROVED" ? "PURCHASE_APPROVED" : "PURCHASE_CANCELLED",
        entity: "PurchaseOrder",
        entityId,
        oldValues: { status: po.status, version: po.version },
        newValues: { status: finalStatus, version: po.version + 1 },
      },
      tx,
    );
  }
}
