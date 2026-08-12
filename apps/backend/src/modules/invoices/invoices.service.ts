import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { AuditService } from "../../common/audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AuthUser } from "../auth/interfaces/auth-user.interface";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { UpdateInvoiceDto } from "./dto/update-invoice.dto";
import { IssueInvoiceDto } from "./dto/issue-invoice.dto";
import { PayInvoiceDto } from "./dto/pay-invoice.dto";
import { CancelInvoiceDto } from "./dto/cancel-invoice.dto";
import { GenerateInvoiceDto } from "./dto/generate-invoice.dto";
import { QueryInvoiceDto } from "./dto/query-invoice.dto";
import {
  TransactionHelper,
  PrismaTx,
} from "../../common/transactions/transaction.helper";
import {
  Prisma,
  Invoice,
  InvoiceType,
  InvoiceStatus,
  SalesOrderStatus,
  PurchaseOrderStatus,
  JournalSourceType,
  TaxTransactionSourceType,
} from "@amdox/database/generated";
import { NotificationType } from "../notifications/dto/query-notification.dto";
import { AccountingService } from "../accounting/accounting.service";
import { TaxService } from "../tax/tax.service";

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly transactionHelper: TransactionHelper,
    private readonly accountingService: AccountingService,
    private readonly taxService: TaxService,
  ) {}

  private async generateInvoiceNumber(
    tenantId: string,
    type: InvoiceType,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const typeCode = type === InvoiceType.SALES ? "S" : "P";
    const prefix = `INV-${typeCode}-${year}-`;

    const lastInvoice = await this.prisma.invoice.findFirst({
      where: {
        tenantId,
        invoiceNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        invoiceNumber: "desc",
      },
      select: {
        invoiceNumber: true,
      },
    });

    let nextSeq = 1;
    if (lastInvoice) {
      const parts = lastInvoice.invoiceNumber.split("-");
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }

    return `${prefix}${String(nextSeq).padStart(6, "0")}`;
  }

  async create(dto: CreateInvoiceDto, user: AuthUser): Promise<Invoice> {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    const tenantId = user.tenantId!;

    // Validation
    if (dto.type === InvoiceType.SALES) {
      if (!dto.customerId) {
        throw new BadRequestException(
          "customerId is required for Sales Invoices.",
        );
      }
      const customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, tenantId, deletedAt: null },
      });
      if (!customer) {
        throw new NotFoundException(
          `Customer with ID ${dto.customerId} not found.`,
        );
      }
    } else {
      if (!dto.supplierName) {
        throw new BadRequestException(
          "supplierName is required for Purchase Invoices.",
        );
      }
    }

    let subtotal = new Prisma.Decimal(0);
    let taxTotal = new Prisma.Decimal(0);
    let discountTotal = new Prisma.Decimal(0);
    let grandTotal = new Prisma.Decimal(0);

    const itemsData: {
      productId: string;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      taxRate: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
      totalPrice: Prisma.Decimal;
    }[] = [];

    // Get jurisdiction from customer address if available
    let jurisdiction: string | undefined = undefined;
    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, tenantId, deletedAt: null },
      });
      if (customer && customer.address) {
        if (customer.address.includes("CA")) jurisdiction = "CA";
        else if (customer.address.includes("NY")) jurisdiction = "NY";
        else jurisdiction = customer.address;
      }
    }

    const calcItemsInput = [];
    for (const item of dto.items) {
      const product = await this.prisma.product.findFirst({
        where: { id: item.productId, tenantId, deletedAt: null },
        include: { taxCategory: true },
      });
      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found.`);
      }
      calcItemsInput.push({
        productId: item.productId,
        taxCategoryId: product.taxCategoryId || "",
        baseAmount: Number(
          new Prisma.Decimal(item.quantity).mul(
            new Prisma.Decimal(item.unitPrice),
          ),
        ),
      });
    }

    const calcResult = await this.taxService.calculateTax(
      {
        customerId: dto.type === InvoiceType.SALES ? dto.customerId : undefined,
        supplierId: undefined,
        jurisdiction,
        items: calcItemsInput,
      },
      tenantId,
    );

    subtotal = new Prisma.Decimal(calcResult.totalBaseAmount);
    taxTotal = new Prisma.Decimal(calcResult.totalTaxAmount);

    for (let i = 0; i < dto.items.length; i++) {
      const item = dto.items[i];
      const calcItem = calcResult.items[i];
      const quantity = new Prisma.Decimal(item.quantity);
      const unitPrice = new Prisma.Decimal(item.unitPrice);
      const lineSubtotal = quantity.mul(unitPrice);
      const taxRate = new Prisma.Decimal(calcItem.rate);
      const taxAmount = new Prisma.Decimal(calcItem.taxAmount);
      const discountAmount = new Prisma.Decimal(item.discountAmount || 0);
      const totalPrice = lineSubtotal.add(taxAmount).sub(discountAmount);

      discountTotal = discountTotal.add(discountAmount);
      grandTotal = grandTotal.add(totalPrice);

      itemsData.push({
        productId: item.productId,
        quantity,
        unitPrice,
        taxRate,
        taxAmount,
        discountAmount,
        totalPrice,
      });
    }

    let retries = 3;
    let invoice: Invoice | null = null;

    while (retries > 0) {
      try {
        const invoiceNumber = await this.generateInvoiceNumber(
          tenantId,
          dto.type,
        );
        invoice = await this.transactionHelper.run(async (tx: PrismaTx) => {
          const inv = await tx.invoice.create({
            data: {
              tenantId,
              type: dto.type,
              invoiceNumber,
              referenceType: dto.referenceType || null,
              referenceId: dto.referenceId || null,
              customerId:
                dto.type === InvoiceType.SALES ? dto.customerId : null,
              supplierName:
                dto.type === InvoiceType.PURCHASE ? dto.supplierName : null,
              invoiceDate: new Date(dto.invoiceDate),
              dueDate: new Date(dto.dueDate),
              currency: dto.currency || "USD",
              subtotal,
              taxTotal,
              discountTotal,
              grandTotal,
              amountPaid: 0.0,
              status: InvoiceStatus.DRAFT,
              version: 1,
              createdBy: user.id,
              items: {
                createMany: {
                  data: itemsData.map((item) => ({
                    tenantId,
                    productId: item.productId,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    taxRate: item.taxRate,
                    taxAmount: item.taxAmount,
                    discountAmount: item.discountAmount,
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
              action: "INVOICE_CREATED",
              entity: "Invoice",
              entityId: inv.id,
              newValues: {
                id: inv.id,
                invoiceNumber: inv.invoiceNumber,
                type: inv.type,
                grandTotal: inv.grandTotal.toString(),
              },
            },
            tx,
          );

          return inv;
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
              "Failed to generate a unique invoice number.",
            );
          }
        } else {
          throw error;
        }
      }
    }

    if (!invoice) {
      throw new BadRequestException("Failed to create invoice.");
    }

    return invoice;
  }

  async generateFromSource(
    dto: GenerateInvoiceDto,
    user: AuthUser,
  ): Promise<Invoice> {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    const tenantId = user.tenantId!;

    // Check duplicate generation
    const existing = await this.prisma.invoice.findFirst({
      where: {
        tenantId,
        referenceType: dto.sourceType,
        referenceId: dto.sourceId,
        status: { not: InvoiceStatus.CANCELLED },
      },
    });

    if (existing) {
      throw new BadRequestException(
        `An active invoice has already been generated from this ${dto.sourceType}.`,
      );
    }

    let customerId: string | null = null;
    let supplierName: string | null = null;
    const currency = "USD";
    const itemsDto: {
      productId: string;
      quantity: number;
      unitPrice: number;
      discountAmount: number;
    }[] = [];

    if (dto.sourceType === "SalesOrder") {
      const so = await this.prisma.salesOrder.findFirst({
        where: { id: dto.sourceId, tenantId, deletedAt: null },
        include: { items: true },
      });

      if (!so) {
        throw new NotFoundException(
          `Sales Order with ID ${dto.sourceId} not found.`,
        );
      }

      if (
        so.status === SalesOrderStatus.DRAFT ||
        so.status === SalesOrderStatus.CANCELLED
      ) {
        throw new BadRequestException(
          `Cannot invoice a Sales Order in ${so.status} status.`,
        );
      }

      customerId = so.customerId;
      for (const item of so.items) {
        itemsDto.push({
          productId: item.productId,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          discountAmount: 0.0,
        });
      }
    } else {
      const po = await this.prisma.purchaseOrder.findFirst({
        where: { id: dto.sourceId, tenantId, deletedAt: null },
        include: { items: true },
      });

      if (!po) {
        throw new NotFoundException(
          `Purchase Order with ID ${dto.sourceId} not found.`,
        );
      }

      if (
        po.status === PurchaseOrderStatus.DRAFT ||
        po.status === PurchaseOrderStatus.CANCELLED
      ) {
        throw new BadRequestException(
          `Cannot invoice a Purchase Order in ${po.status} status.`,
        );
      }

      supplierName = po.supplierName;
      for (const item of po.items) {
        itemsDto.push({
          productId: item.productId,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          discountAmount: 0.0,
        });
      }
    }

    const invoiceDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30); // 30 days default payment term

    return this.create(
      {
        type:
          dto.sourceType === "SalesOrder"
            ? InvoiceType.SALES
            : InvoiceType.PURCHASE,
        customerId: customerId || undefined,
        supplierName: supplierName || undefined,
        invoiceDate: invoiceDate.toISOString(),
        dueDate: dueDate.toISOString(),
        currency,
        referenceType: dto.sourceType,
        referenceId: dto.sourceId,
        items: itemsDto,
      },
      user,
    );
  }

  async findAll(query: QueryInvoiceDto, user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.InvoiceWhereInput = {
      tenantId: user.tenantId!,
      deletedAt: null,
    };

    if (query.type) {
      where.type = query.type;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.invoiceNumber) {
      where.invoiceNumber = {
        contains: query.invoiceNumber,
        mode: "insensitive",
      };
    }

    const sortField = query.sort || "createdAt";
    const order = query.order || "desc";

    const [totalItems, data] = await Promise.all([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        orderBy: { [sortField]: order },
        skip,
        take: limit,
        include: {
          items: true,
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

  async findOne(id: string, user: AuthUser): Promise<Invoice> {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId: user.tenantId!, deletedAt: null },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found.`);
    }

    return invoice;
  }

  async update(
    id: string,
    dto: UpdateInvoiceDto,
    user: AuthUser,
  ): Promise<Invoice> {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    const tenantId = user.tenantId!;

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id, tenantId, deletedAt: null },
      });

      if (!invoice) {
        throw new NotFoundException(`Invoice with ID ${id} not found.`);
      }

      if (invoice.status !== InvoiceStatus.DRAFT) {
        throw new BadRequestException(
          `Only DRAFT invoices can be modified. Current status: ${invoice.status}`,
        );
      }

      if (invoice.version !== dto.expectedVersion) {
        throw new ConflictException(
          `Optimistic concurrency lock failed. Expected version: ${invoice.version}`,
        );
      }

      let customerId = invoice.customerId;
      let supplierName = invoice.supplierName;

      const type = dto.type || invoice.type;

      if (type === InvoiceType.SALES) {
        const checkCustId = dto.customerId || invoice.customerId;
        if (!checkCustId) {
          throw new BadRequestException(
            "customerId is required for Sales Invoices.",
          );
        }
        const customer = await tx.customer.findFirst({
          where: { id: checkCustId, tenantId, deletedAt: null },
        });
        if (!customer) {
          throw new NotFoundException(
            `Customer with ID ${checkCustId} not found.`,
          );
        }
        customerId = checkCustId;
        supplierName = null;
      } else {
        const checkSupplierName = dto.supplierName || invoice.supplierName;
        if (!checkSupplierName) {
          throw new BadRequestException(
            "supplierName is required for Purchase Invoices.",
          );
        }
        supplierName = checkSupplierName;
        customerId = null;
      }

      const invoiceDate = dto.invoiceDate
        ? new Date(dto.invoiceDate)
        : invoice.invoiceDate;
      const dueDate = dto.dueDate ? new Date(dto.dueDate) : invoice.dueDate;
      const currency = dto.currency || invoice.currency;

      let subtotal = invoice.subtotal;
      let taxTotal = invoice.taxTotal;
      let discountTotal = invoice.discountTotal;
      let grandTotal = invoice.grandTotal;

      if (dto.items) {
        await tx.invoiceItem.deleteMany({
          where: { invoiceId: id },
        });

        subtotal = new Prisma.Decimal(0);
        taxTotal = new Prisma.Decimal(0);
        discountTotal = new Prisma.Decimal(0);
        grandTotal = new Prisma.Decimal(0);

        const itemsData: {
          productId: string;
          quantity: Prisma.Decimal;
          unitPrice: Prisma.Decimal;
          taxRate: Prisma.Decimal;
          taxAmount: Prisma.Decimal;
          discountAmount: Prisma.Decimal;
          totalPrice: Prisma.Decimal;
        }[] = [];

        // Get jurisdiction from customer address if available
        let jurisdiction: string | undefined = undefined;
        const targetCustomerId =
          customerId !== undefined ? customerId : invoice.customerId;
        if (targetCustomerId) {
          const customer = await tx.customer.findFirst({
            where: { id: targetCustomerId, tenantId, deletedAt: null },
          });
          if (customer && customer.address) {
            if (customer.address.includes("CA")) jurisdiction = "CA";
            else if (customer.address.includes("NY")) jurisdiction = "NY";
            else jurisdiction = customer.address;
          }
        }

        const calcItemsInput = [];
        for (const item of dto.items) {
          const product = await tx.product.findFirst({
            where: { id: item.productId, tenantId, deletedAt: null },
            include: { taxCategory: true },
          });
          if (!product) {
            throw new NotFoundException(`Product ${item.productId} not found.`);
          }
          calcItemsInput.push({
            productId: item.productId,
            taxCategoryId: product.taxCategoryId || "",
            baseAmount: Number(
              new Prisma.Decimal(item.quantity).mul(
                new Prisma.Decimal(item.unitPrice),
              ),
            ),
          });
        }

        const calcResult = await this.taxService.calculateTax(
          {
            customerId:
              type === InvoiceType.SALES
                ? targetCustomerId || undefined
                : undefined,
            supplierId: undefined,
            jurisdiction,
            items: calcItemsInput,
          },
          tenantId,
        );

        subtotal = new Prisma.Decimal(calcResult.totalBaseAmount);
        taxTotal = new Prisma.Decimal(calcResult.totalTaxAmount);

        for (let i = 0; i < dto.items.length; i++) {
          const item = dto.items[i];
          const calcItem = calcResult.items[i];
          const quantity = new Prisma.Decimal(item.quantity);
          const unitPrice = new Prisma.Decimal(item.unitPrice);
          const lineSubtotal = quantity.mul(unitPrice);
          const taxRate = new Prisma.Decimal(calcItem.rate);
          const taxAmount = new Prisma.Decimal(calcItem.taxAmount);
          const discountAmount = new Prisma.Decimal(item.discountAmount || 0);
          const totalPrice = lineSubtotal.add(taxAmount).sub(discountAmount);

          discountTotal = discountTotal.add(discountAmount);
          grandTotal = grandTotal.add(totalPrice);

          itemsData.push({
            productId: item.productId,
            quantity,
            unitPrice,
            taxRate,
            taxAmount,
            discountAmount,
            totalPrice,
          });
        }

        await tx.invoiceItem.createMany({
          data: itemsData.map((item) => ({
            tenantId,
            invoiceId: id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
            taxAmount: item.taxAmount,
            discountAmount: item.discountAmount,
            totalPrice: item.totalPrice,
          })),
        });
      }

      const updated = await tx.invoice.update({
        where: { id },
        data: {
          type,
          customerId,
          supplierName,
          invoiceDate,
          dueDate,
          currency,
          subtotal,
          taxTotal,
          discountTotal,
          grandTotal,
          version: invoice.version + 1,
          updatedBy: user.id,
        },
        include: {
          items: true,
        },
      });

      await this.auditService.log(
        {
          action: "INVOICE_UPDATED",
          entity: "Invoice",
          entityId: invoice.id,
          oldValues: {
            grandTotal: invoice.grandTotal.toString(),
            version: invoice.version,
          },
          newValues: {
            grandTotal: updated.grandTotal.toString(),
            version: updated.version,
          },
        },
        tx,
      );

      return updated;
    });
  }

  async issue(
    id: string,
    dto: IssueInvoiceDto,
    user: AuthUser,
  ): Promise<Invoice> {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id, tenantId: user.tenantId!, deletedAt: null },
      });

      if (!invoice) {
        throw new NotFoundException(`Invoice with ID ${id} not found.`);
      }

      if (invoice.status !== InvoiceStatus.DRAFT) {
        throw new BadRequestException(
          `Only DRAFT invoices can be issued. Current status: ${invoice.status}`,
        );
      }

      if (invoice.version !== dto.expectedVersion) {
        throw new ConflictException(
          `Optimistic concurrency lock failed. Expected version: ${invoice.version}`,
        );
      }

      const updated = await tx.invoice.update({
        where: { id },
        data: {
          status: InvoiceStatus.ISSUED,
          version: invoice.version + 1,
          updatedBy: user.id,
        },
      });

      // Audit Log
      await this.auditService.log(
        {
          action: "INVOICE_ISSUED",
          entity: "Invoice",
          entityId: id,
          oldValues: { status: invoice.status, version: invoice.version },
          newValues: { status: updated.status, version: updated.version },
        },
        tx,
      );

      // Notification
      await this.notificationsService.createInternal({
        userId: invoice.createdBy,
        tenantId: invoice.tenantId,
        title: "Invoice Issued",
        message: `Invoice ${invoice.invoiceNumber} has been issued successfully.`,
        type: NotificationType.SUCCESS,
      });

      // Record TaxTransactions
      const invoiceItems = await tx.invoiceItem.findMany({
        where: { invoiceId: id },
        include: { product: true },
      });

      let issueJurisdiction: string | undefined = undefined;
      if (invoice.customerId) {
        const customer = await tx.customer.findFirst({
          where: {
            id: invoice.customerId,
            tenantId: invoice.tenantId,
            deletedAt: null,
          },
        });
        if (customer && customer.address) {
          if (customer.address.includes("CA")) issueJurisdiction = "CA";
          else if (customer.address.includes("NY")) issueJurisdiction = "NY";
          else issueJurisdiction = customer.address;
        }
      }

      const calcResult = await this.taxService.calculateTax(
        {
          customerId:
            invoice.type === InvoiceType.SALES
              ? invoice.customerId || undefined
              : undefined,
          supplierId: undefined,
          jurisdiction: issueJurisdiction,
          items: invoiceItems.map((item) => ({
            productId: item.productId,
            taxCategoryId: item.product.taxCategoryId || "",
            baseAmount: Number(item.quantity.mul(item.unitPrice)),
          })),
        },
        invoice.tenantId,
      );

      for (let i = 0; i < invoiceItems.length; i++) {
        const calcItem = calcResult.items[i];
        if (calcItem.taxRuleId) {
          await this.taxService.recordTaxTransaction(
            tx,
            {
              sourceType: TaxTransactionSourceType.INVOICE,
              sourceId: id,
              taxRuleId: calcItem.taxRuleId,
              baseAmount: new Prisma.Decimal(calcItem.baseAmount),
              taxAmount: new Prisma.Decimal(calcItem.taxAmount),
              rate: new Prisma.Decimal(calcItem.rate),
            },
            invoice.tenantId,
          );
        }
      }

      // Automated GL Posting
      const lines =
        invoice.type === InvoiceType.SALES
          ? [
              { code: "1200", debit: Number(invoice.grandTotal), credit: 0 },
              { code: "4000", debit: 0, credit: Number(invoice.grandTotal) },
            ]
          : [
              { code: "5100", debit: Number(invoice.grandTotal), credit: 0 },
              { code: "2000", debit: 0, credit: Number(invoice.grandTotal) },
            ];

      await this.accountingService.automatedPost(
        tx,
        JournalSourceType.INVOICE,
        invoice.id,
        `Invoice issued: ${invoice.invoiceNumber}`,
        lines,
        { id: user.id, tenantId: user.tenantId! },
      );

      return updated;
    });
  }

  async recordPayment(
    id: string,
    dto: PayInvoiceDto,
    user: AuthUser,
  ): Promise<Invoice> {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id, tenantId: user.tenantId!, deletedAt: null },
      });

      if (!invoice) {
        throw new NotFoundException(`Invoice with ID ${id} not found.`);
      }

      if (
        invoice.status === InvoiceStatus.DRAFT ||
        invoice.status === InvoiceStatus.CANCELLED
      ) {
        throw new BadRequestException(
          `Cannot record payment on a ${invoice.status} invoice.`,
        );
      }

      if (invoice.status === InvoiceStatus.PAID) {
        throw new BadRequestException("Invoice is already fully paid.");
      }

      if (invoice.version !== dto.expectedVersion) {
        throw new ConflictException(
          `Optimistic concurrency lock failed. Expected version: ${invoice.version}`,
        );
      }

      const paymentDecimal = new Prisma.Decimal(dto.amount);
      const currentPaid = new Prisma.Decimal(invoice.amountPaid);
      const grandTotal = new Prisma.Decimal(invoice.grandTotal);

      const remaining = grandTotal.sub(currentPaid);

      if (paymentDecimal.gt(remaining)) {
        throw new BadRequestException(
          `Overpayment is not allowed. Remaining amount due is ${remaining.toString()}.`,
        );
      }

      const nextPaid = currentPaid.add(paymentDecimal);
      const isFullyPaid = nextPaid.equals(grandTotal);
      const nextStatus = isFullyPaid
        ? InvoiceStatus.PAID
        : InvoiceStatus.PARTIALLY_PAID;

      const updated = await tx.invoice.update({
        where: { id },
        data: {
          amountPaid: nextPaid,
          status: nextStatus,
          version: invoice.version + 1,
          updatedBy: user.id,
        },
      });

      // Audit Log
      await this.auditService.log(
        {
          action: "INVOICE_PAYMENT_RECORDED",
          entity: "Invoice",
          entityId: id,
          oldValues: {
            amountPaid: invoice.amountPaid.toString(),
            status: invoice.status,
            version: invoice.version,
          },
          newValues: {
            amountPaid: updated.amountPaid.toString(),
            status: updated.status,
            version: updated.version,
          },
        },
        tx,
      );

      // Notification
      await this.notificationsService.createInternal({
        userId: invoice.createdBy,
        tenantId: invoice.tenantId,
        title: isFullyPaid ? "Invoice Fully Paid" : "Invoice Payment Recorded",
        message: isFullyPaid
          ? `Invoice ${invoice.invoiceNumber} has been fully paid.`
          : `A payment of ${paymentDecimal.toString()} has been recorded for invoice ${invoice.invoiceNumber}.`,
        type: isFullyPaid ? NotificationType.SUCCESS : NotificationType.INFO,
      });

      return updated;
    });
  }

  async cancel(
    id: string,
    dto: CancelInvoiceDto,
    user: AuthUser,
  ): Promise<Invoice> {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id, tenantId: user.tenantId!, deletedAt: null },
      });

      if (!invoice) {
        throw new NotFoundException(`Invoice with ID ${id} not found.`);
      }

      if (
        invoice.status === InvoiceStatus.PAID ||
        invoice.status === InvoiceStatus.CANCELLED
      ) {
        throw new BadRequestException(
          `Cannot cancel a ${invoice.status} invoice.`,
        );
      }

      if (invoice.version !== dto.expectedVersion) {
        throw new ConflictException(
          `Optimistic concurrency lock failed. Expected version: ${invoice.version}`,
        );
      }

      const updated = await tx.invoice.update({
        where: { id },
        data: {
          status: InvoiceStatus.CANCELLED,
          version: invoice.version + 1,
          updatedBy: user.id,
        },
      });

      // Audit Log
      await this.auditService.log(
        {
          action: "INVOICE_CANCELLED",
          entity: "Invoice",
          entityId: id,
          oldValues: { status: invoice.status, version: invoice.version },
          newValues: { status: updated.status, version: updated.version },
        },
        tx,
      );

      // Notification
      await this.notificationsService.createInternal({
        userId: invoice.createdBy,
        tenantId: invoice.tenantId,
        title: "Invoice Cancelled",
        message: `Invoice ${invoice.invoiceNumber} has been cancelled.`,
        type: NotificationType.WARNING,
      });

      return updated;
    });
  }
}
