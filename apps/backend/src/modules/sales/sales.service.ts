import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { StockService } from "../inventory/stock.service";
import { AuditService } from "../../common/audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AuthUser } from "../auth/interfaces/auth-user.interface";
import { CreateSalesOrderDto } from "./dto/create-sales-order.dto";
import { UpdateSalesOrderDto } from "./dto/update-sales-order.dto";
import { ConfirmSalesOrderDto } from "./dto/confirm-sales-order.dto";
import { DeliverSalesOrderDto } from "./dto/deliver-sales-order.dto";
import { CancelSalesOrderDto } from "./dto/cancel-sales-order.dto";
import { QuerySalesOrderDto } from "./dto/query-sales-order.dto";
import {
  TransactionHelper,
  PrismaTx,
} from "../../common/transactions/transaction.helper";
import {
  Prisma,
  SalesOrderStatus,
  StockTransactionType,
  SalesOrder,
  JournalSourceType,
} from "@amdox/database/generated";
import { NotificationType } from "../notifications/dto/query-notification.dto";
import { AccountingService } from "../accounting/accounting.service";
import { TaxService } from "../tax/tax.service";
import { TaxTransactionSourceType } from "@amdox/database/generated";

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly transactionHelper: TransactionHelper,
    private readonly accountingService: AccountingService,
    private readonly taxService: TaxService,
  ) {}

  private async generateOrderNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `SO-${year}-`;

    const lastOrder = await this.prisma.salesOrder.findFirst({
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

  async create(dto: CreateSalesOrderDto, user: AuthUser): Promise<SalesOrder> {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    const tenantId = user.tenantId!;

    // Check customer exists
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, tenantId, deletedAt: null },
    });
    if (!customer) {
      throw new NotFoundException(
        `Customer with ID ${dto.customerId} not found.`,
      );
    }

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
    let salesOrder: SalesOrder | null = null;

    while (retries > 0) {
      try {
        const orderNumber = await this.generateOrderNumber(tenantId);
        salesOrder = await this.transactionHelper.run(async (tx: PrismaTx) => {
          const so = await tx.salesOrder.create({
            data: {
              tenantId,
              customerId: dto.customerId,
              orderNumber,
              expectedDeliveryDate: new Date(dto.expectedDeliveryDate),
              notes: dto.notes || null,
              totalAmount,
              createdBy: user.id,
              status: SalesOrderStatus.DRAFT,
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
              action: "SALES_CREATED",
              entity: "SalesOrder",
              entityId: so.id,
              newValues: {
                id: so.id,
                orderNumber: so.orderNumber,
                customerId: so.customerId,
                totalAmount: so.totalAmount.toString(),
              },
            },
            tx,
          );

          return so;
        });

        break;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          retries--;
          if (retries === 0) {
            throw new ConflictException(
              "Failed to generate a unique sales order number.",
            );
          }
        } else {
          throw error;
        }
      }
    }

    if (!salesOrder) {
      throw new BadRequestException("Failed to create sales order.");
    }

    return salesOrder;
  }

  async findAll(query: QuerySalesOrderDto, user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.SalesOrderWhereInput = {
      tenantId: user.tenantId!,
      deletedAt: null,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.customerId) {
      where.customerId = query.customerId;
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
      this.prisma.salesOrder.count({ where }),
      this.prisma.salesOrder.findMany({
        where,
        orderBy: { [sortField]: order },
        skip,
        take: limit,
        include: {
          items: {
            select: {
              productId: true,
              quantity: true,
              deliveredQuantity: true,
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

  async findOne(id: string, user: AuthUser): Promise<SalesOrder> {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    const so = await this.prisma.salesOrder.findFirst({
      where: { id, tenantId: user.tenantId!, deletedAt: null },
      include: {
        items: true,
        deliveries: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!so) {
      throw new NotFoundException(`Sales Order with ID ${id} not found.`);
    }

    return so;
  }

  async update(
    id: string,
    dto: UpdateSalesOrderDto,
    user: AuthUser,
  ): Promise<SalesOrder> {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    const tenantId = user.tenantId!;

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const so = await tx.salesOrder.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: { items: true },
      });

      if (!so) {
        throw new NotFoundException(`Sales Order with ID ${id} not found.`);
      }

      if (so.status !== SalesOrderStatus.DRAFT) {
        throw new BadRequestException(
          `Only DRAFT orders can be modified. Current status: ${so.status}`,
        );
      }

      if (so.version !== dto.expectedVersion) {
        throw new ConflictException(
          `Optimistic concurrency lock failed. Expected version: ${so.version}`,
        );
      }

      const customerId = dto.customerId || so.customerId;
      if (dto.customerId) {
        const customer = await tx.customer.findFirst({
          where: { id: dto.customerId, tenantId, deletedAt: null },
        });
        if (!customer) {
          throw new NotFoundException(
            `Customer with ID ${dto.customerId} not found.`,
          );
        }
      }

      const expectedDeliveryDate = dto.expectedDeliveryDate
        ? new Date(dto.expectedDeliveryDate)
        : so.expectedDeliveryDate;
      const notes = dto.notes !== undefined ? dto.notes || null : so.notes;

      let totalAmount = so.totalAmount;
      if (dto.items) {
        // Drop existing lines and recreate
        await tx.salesOrderItem.deleteMany({
          where: { salesOrderId: id },
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

        await tx.salesOrderItem.createMany({
          data: itemsData.map((item) => ({
            tenantId,
            salesOrderId: id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          })),
        });

        totalAmount = newTotal;
      }

      const updated = await tx.salesOrder.update({
        where: { id },
        data: {
          customerId,
          expectedDeliveryDate,
          notes,
          totalAmount,
          version: so.version + 1,
          updatedBy: user.id,
        },
        include: {
          items: true,
        },
      });

      await this.auditService.log(
        {
          action: "SALES_UPDATED",
          entity: "SalesOrder",
          entityId: so.id,
          oldValues: {
            customerId: so.customerId,
            totalAmount: so.totalAmount.toString(),
            version: so.version,
          },
          newValues: {
            customerId: updated.customerId,
            totalAmount: updated.totalAmount.toString(),
            version: updated.version,
          },
        },
        tx,
      );

      return updated;
    });
  }

  async confirm(
    id: string,
    dto: ConfirmSalesOrderDto,
    user: AuthUser,
  ): Promise<SalesOrder> {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const so = await tx.salesOrder.findFirst({
        where: { id, tenantId: user.tenantId!, deletedAt: null },
      });

      if (!so) {
        throw new NotFoundException(`Sales Order with ID ${id} not found.`);
      }

      if (so.status !== SalesOrderStatus.DRAFT) {
        throw new BadRequestException(
          `Only DRAFT orders can be confirmed. Current status: ${so.status}`,
        );
      }

      if (so.version !== dto.expectedVersion) {
        throw new ConflictException(
          `Optimistic concurrency lock failed. Expected version: ${so.version}`,
        );
      }

      const updated = await tx.salesOrder.update({
        where: { id },
        data: {
          status: SalesOrderStatus.CONFIRMED,
          version: so.version + 1,
          updatedBy: user.id,
        },
      });

      // Audit Log
      await this.auditService.log(
        {
          action: "SALES_CONFIRMED",
          entity: "SalesOrder",
          entityId: id,
          oldValues: { status: so.status, version: so.version },
          newValues: { status: updated.status, version: updated.version },
        },
        tx,
      );

      // Notification
      await this.notificationsService.createInternal({
        userId: so.createdBy,
        tenantId: so.tenantId,
        title: "Sales Order Confirmed",
        message: `Your Sales Order ${so.orderNumber} has been confirmed.`,
        type: NotificationType.SUCCESS,
      });

      // Record TaxTransactions
      const soItems = await tx.salesOrderItem.findMany({
        where: { salesOrderId: id },
        include: { product: true },
      });

      let jurisdiction: string | undefined = undefined;
      const customer = await tx.customer.findFirst({
        where: { id: so.customerId, tenantId: so.tenantId, deletedAt: null },
      });
      if (customer && customer.address) {
        if (customer.address.includes("CA")) jurisdiction = "CA";
        else if (customer.address.includes("NY")) jurisdiction = "NY";
        else jurisdiction = customer.address;
      }

      const calcResult = await this.taxService.calculateTax(
        {
          customerId: so.customerId,
          jurisdiction,
          items: soItems.map((item) => ({
            productId: item.productId,
            taxCategoryId: item.product.taxCategoryId || "",
            baseAmount: Number(item.quantity.mul(item.unitPrice)),
          })),
        },
        so.tenantId,
      );

      for (let i = 0; i < soItems.length; i++) {
        const calcItem = calcResult.items[i];
        if (calcItem.taxRuleId) {
          await this.taxService.recordTaxTransaction(
            tx,
            {
              sourceType: TaxTransactionSourceType.SALES,
              sourceId: id,
              taxRuleId: calcItem.taxRuleId,
              baseAmount: new Prisma.Decimal(calcItem.baseAmount),
              taxAmount: new Prisma.Decimal(calcItem.taxAmount),
              rate: new Prisma.Decimal(calcItem.rate),
            },
            so.tenantId,
          );
        }
      }

      return updated;
    });
  }

  async deliver(
    id: string,
    dto: DeliverSalesOrderDto,
    user: AuthUser,
  ): Promise<SalesOrder> {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    const tenantId = user.tenantId!;

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      // Deterministic Row Lock: Sort dispatch items by productId ascending to prevent deadlocks
      const sortedReceiptItems = [...dto.items].sort((a, b) =>
        a.productId.localeCompare(b.productId),
      );

      // Retrieve SO & items
      const so = await tx.salesOrder.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: { items: true },
      });

      if (!so) {
        throw new NotFoundException(`Sales Order with ID ${id} not found.`);
      }

      if (
        so.status !== SalesOrderStatus.CONFIRMED &&
        so.status !== SalesOrderStatus.PARTIALLY_DELIVERED
      ) {
        throw new BadRequestException(
          `Cannot dispatch delivery on sales order with status ${so.status}.`,
        );
      }

      if (so.version !== dto.expectedVersion) {
        throw new ConflictException(
          `Optimistic concurrency lock failed. Expected version: ${so.version}`,
        );
      }

      // Verify warehouse exists
      const warehouse = await tx.warehouse.findFirst({
        where: { id: dto.warehouseId, tenantId, deletedAt: null },
      });
      if (!warehouse) {
        throw new NotFoundException(`Warehouse ${dto.warehouseId} not found.`);
      }

      // Create SalesDelivery document
      const delivery = await tx.salesDelivery.create({
        data: {
          tenantId,
          salesOrderId: id,
          warehouseId: dto.warehouseId,
          deliveredBy: user.id,
          remarks: dto.remarks || null,
        },
      });

      const deliveryItemsData: {
        salesDeliveryId: string;
        tenantId: string;
        productId: string;
        quantityDelivered: number;
      }[] = [];

      for (const item of sortedReceiptItems) {
        const soItem = so.items.find(
          (line) => line.productId === item.productId,
        );
        if (!soItem) {
          throw new BadRequestException(
            `Product ${item.productId} is not part of Sales Order ${so.orderNumber}.`,
          );
        }

        const currentDelivered = Number(soItem.deliveredQuantity);
        const orderedQty = Number(soItem.quantity);
        const remaining = orderedQty - currentDelivered;

        if (item.quantityDelivered > remaining) {
          throw new BadRequestException(
            `Quantity delivered (${item.quantityDelivered}) exceeds remaining ordered quantity (${remaining}) for product ${item.productId}.`,
          );
        }

        const newDeliveredQty = currentDelivered + item.quantityDelivered;

        // Update sales order item delivered quantity
        await tx.salesOrderItem.update({
          where: { id: soItem.id },
          data: {
            deliveredQuantity: newDeliveredQty,
          },
        });

        // Generate delivery items data
        deliveryItemsData.push({
          salesDeliveryId: delivery.id,
          tenantId,
          productId: item.productId,
          quantityDelivered: item.quantityDelivered,
        });

        // Relies on StockService to atomically mutate inventory and log movements.
        // mutateStock naturally checks negative inventory and throws if balance goes < 0.
        await this.stockService.mutateStock(
          tx as unknown as Prisma.TransactionClient,
          tenantId,
          dto.warehouseId,
          item.productId,
          StockTransactionType.STOCK_OUT,
          -item.quantityDelivered, // Negative delta decreases stock
          "SalesDelivery",
          delivery.id,
          user.id,
          dto.remarks || `Sales order dispatch delivery ${so.orderNumber}`,
        );
      }

      // Create delivery items
      await tx.salesDeliveryItem.createMany({
        data: deliveryItemsData,
      });

      // Determine final status
      const refetchedSoItems = await tx.salesOrderItem.findMany({
        where: { salesOrderId: id },
      });

      const isCompleted = refetchedSoItems.every(
        (line) => Number(line.deliveredQuantity) === Number(line.quantity),
      );
      const nextStatus = isCompleted
        ? SalesOrderStatus.DELIVERED
        : SalesOrderStatus.PARTIALLY_DELIVERED;

      const updated = await tx.salesOrder.update({
        where: { id },
        data: {
          status: nextStatus,
          version: so.version + 1,
          updatedBy: user.id,
        },
      });

      // Audit Log
      await this.auditService.log(
        {
          action: "SALES_DELIVERED",
          entity: "SalesOrder",
          entityId: id,
          oldValues: { status: so.status, version: so.version },
          newValues: {
            status: updated.status,
            version: updated.version,
            deliveryId: delivery.id,
          },
        },
        tx,
      );

      // Notification
      await this.notificationsService.createInternal({
        userId: so.createdBy,
        tenantId: so.tenantId,
        title: isCompleted ? "Sales Order Delivered" : "Sales Order Dispatched",
        message: isCompleted
          ? `Your Sales Order ${so.orderNumber} is fully delivered.`
          : `Your Sales Order ${so.orderNumber} is partially delivered.`,
        type: isCompleted ? NotificationType.SUCCESS : NotificationType.INFO,
      });

      // Automated GL Posting
      let totalCost = 0;
      for (const item of sortedReceiptItems) {
        const soItem = so.items.find(
          (line) => line.productId === item.productId,
        );
        if (soItem) {
          totalCost += item.quantityDelivered * Number(soItem.unitPrice);
        }
      }

      if (totalCost > 0) {
        await this.accountingService.automatedPost(
          tx,
          JournalSourceType.STOCK_MOVEMENT,
          delivery.id,
          `Inventory issue: SO ${so.orderNumber}`,
          [
            { code: "5000", debit: totalCost, credit: 0 },
            { code: "1400", debit: 0, credit: totalCost },
          ],
          { id: user.id, tenantId },
        );
      }

      return updated;
    });
  }

  async cancel(
    id: string,
    dto: CancelSalesOrderDto,
    user: AuthUser,
  ): Promise<SalesOrder> {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const so = await tx.salesOrder.findFirst({
        where: { id, tenantId: user.tenantId!, deletedAt: null },
      });

      if (!so) {
        throw new NotFoundException(`Sales Order with ID ${id} not found.`);
      }

      if (
        so.status !== SalesOrderStatus.DRAFT &&
        so.status !== SalesOrderStatus.CONFIRMED
      ) {
        throw new BadRequestException(
          `Cannot cancel sales order in ${so.status} status.`,
        );
      }

      if (so.version !== dto.expectedVersion) {
        throw new ConflictException(
          `Optimistic concurrency lock failed. Expected version: ${so.version}`,
        );
      }

      const updated = await tx.salesOrder.update({
        where: { id },
        data: {
          status: SalesOrderStatus.CANCELLED,
          version: so.version + 1,
          updatedBy: user.id,
        },
      });

      // Audit Log
      await this.auditService.log(
        {
          action: "SALES_CANCELLED",
          entity: "SalesOrder",
          entityId: id,
          oldValues: { status: so.status, version: so.version },
          newValues: { status: updated.status, version: updated.version },
        },
        tx,
      );

      // Notification
      await this.notificationsService.createInternal({
        userId: so.createdBy,
        tenantId: so.tenantId,
        title: "Sales Order Cancelled",
        message: `Your Sales Order ${so.orderNumber} has been cancelled.`,
        type: NotificationType.WARNING,
      });

      return updated;
    });
  }
}
