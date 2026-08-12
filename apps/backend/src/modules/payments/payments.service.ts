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
import { CreatePaymentDto, PaymentType } from "./dto/create-payment.dto";
import { UpdatePaymentDto } from "./dto/update-payment.dto";
import { PostPaymentDto } from "./dto/post-payment.dto";
import { ReversePaymentDto } from "./dto/reverse-payment.dto";
import { QueryPaymentDto, PaymentStatus } from "./dto/query-payment.dto";
import {
  TransactionHelper,
  PrismaTx,
} from "../../common/transactions/transaction.helper";
import {
  Prisma,
  Payment,
  InvoiceType,
  InvoiceStatus,
  JournalSourceType,
} from "@amdox/database/generated";
import { NotificationType } from "../notifications/dto/query-notification.dto";
import { AccountingService } from "../accounting/accounting.service";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly transactionHelper: TransactionHelper,
    private readonly accountingService: AccountingService,
  ) {}

  private async generatePaymentNumber(
    tenantId: string,
    type: PaymentType,
    paymentDateStr: string,
  ): Promise<string> {
    const year = new Date(paymentDateStr).getFullYear();
    const typeCode = type === PaymentType.RECEIPT ? "R" : "D";
    const prefix = `PAY-${typeCode}-${year}-`;

    const lastPayment = await this.prisma.payment.findFirst({
      where: {
        tenantId,
        paymentNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        paymentNumber: "desc",
      },
      select: {
        paymentNumber: true,
      },
    });

    let nextSeq = 1;
    if (lastPayment) {
      const parts = lastPayment.paymentNumber.split("-");
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }

    return `${prefix}${String(nextSeq).padStart(6, "0")}`;
  }

  async create(dto: CreatePaymentDto, user: AuthUser): Promise<Payment> {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    const tenantId = user.tenantId!;

    // Basic Validations based on type
    if (dto.type === PaymentType.RECEIPT) {
      if (!dto.customerId) {
        throw new BadRequestException(
          "customerId is required for Receipt payments.",
        );
      }
      if (dto.supplierName) {
        throw new BadRequestException(
          "supplierName must be null for Receipt payments.",
        );
      }
      const customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, tenantId, deletedAt: null },
      });
      if (!customer) {
        throw new NotFoundException(`Customer ${dto.customerId} not found.`);
      }
    } else {
      if (!dto.supplierName) {
        throw new BadRequestException(
          "supplierName is required for Disbursement payments.",
        );
      }
      if (dto.customerId) {
        throw new BadRequestException(
          "customerId must be null for Disbursement payments.",
        );
      }
    }

    // Decimal verification of allocations
    const paymentAmount = new Prisma.Decimal(dto.amount);
    let allocationsSum = new Prisma.Decimal(0);
    const invoiceAllocations: {
      invoiceId: string;
      allocatedAmount: Prisma.Decimal;
    }[] = [];

    if (dto.allocations && dto.allocations.length > 0) {
      const seenInvoiceIds = new Set<string>();

      for (const alloc of dto.allocations) {
        if (seenInvoiceIds.has(alloc.invoiceId)) {
          throw new BadRequestException(
            `Duplicate allocation for invoice ${alloc.invoiceId}.`,
          );
        }
        seenInvoiceIds.add(alloc.invoiceId);

        const allocAmount = new Prisma.Decimal(alloc.allocatedAmount);
        if (allocAmount.lte(0)) {
          throw new BadRequestException(
            "Allocation amount must be greater than zero.",
          );
        }

        const invoice = await this.prisma.invoice.findFirst({
          where: { id: alloc.invoiceId, tenantId, deletedAt: null },
        });

        if (!invoice) {
          throw new NotFoundException(`Invoice ${alloc.invoiceId} not found.`);
        }

        // Validate invoice type match
        if (
          dto.type === PaymentType.RECEIPT &&
          invoice.type !== InvoiceType.SALES
        ) {
          throw new BadRequestException(
            "Receipt payments can only target Sales invoices.",
          );
        }
        if (
          dto.type === PaymentType.DISBURSEMENT &&
          invoice.type !== InvoiceType.PURCHASE
        ) {
          throw new BadRequestException(
            "Disbursement payments can only target Purchase invoices.",
          );
        }

        // Validate status
        if (
          invoice.status === InvoiceStatus.DRAFT ||
          invoice.status === InvoiceStatus.CANCELLED
        ) {
          throw new BadRequestException(
            `Cannot allocate to a ${invoice.status} invoice.`,
          );
        }

        // Outstanding balance check
        const outstanding = new Prisma.Decimal(invoice.grandTotal).sub(
          new Prisma.Decimal(invoice.amountPaid),
        );
        if (allocAmount.gt(outstanding)) {
          throw new BadRequestException(
            `Allocation ${allocAmount.toString()} exceeds outstanding balance of ${outstanding.toString()} for invoice ${invoice.invoiceNumber}.`,
          );
        }

        allocationsSum = allocationsSum.add(allocAmount);
        invoiceAllocations.push({
          invoiceId: alloc.invoiceId,
          allocatedAmount: allocAmount,
        });
      }
    }

    // Validate allocation sum does not exceed payment amount
    if (allocationsSum.gt(paymentAmount)) {
      throw new BadRequestException(
        "Total allocated amount cannot exceed payment amount.",
      );
    }

    let retries = 3;
    let payment: Payment | null = null;

    while (retries > 0) {
      try {
        const paymentNumber = await this.generatePaymentNumber(
          tenantId,
          dto.type,
          dto.paymentDate,
        );

        payment = await this.transactionHelper.run(async (tx: PrismaTx) => {
          const pay = await tx.payment.create({
            data: {
              tenantId,
              type: dto.type,
              method: dto.method,
              paymentNumber,
              referenceNumber: dto.referenceNumber || null,
              paymentDate: new Date(dto.paymentDate),
              amount: paymentAmount,
              currency: dto.currency || "USD",
              notes: dto.notes || null,
              customerId:
                dto.type === PaymentType.RECEIPT ? dto.customerId : null,
              supplierName:
                dto.type === PaymentType.DISBURSEMENT ? dto.supplierName : null,
              status: PaymentStatus.DRAFT,
              version: 1,
              createdBy: user.id,
              allocations: {
                createMany: {
                  data: invoiceAllocations.map((a) => ({
                    tenantId,
                    invoiceId: a.invoiceId,
                    allocatedAmount: a.allocatedAmount,
                  })),
                },
              },
            },
            include: {
              allocations: true,
            },
          });

          await this.auditService.log(
            {
              action: "PAYMENT_CREATED",
              entity: "Payment",
              entityId: pay.id,
              newValues: {
                id: pay.id,
                paymentNumber: pay.paymentNumber,
                amount: pay.amount.toString(),
                status: pay.status,
              },
            },
            tx,
          );

          return pay;
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
              "Failed to generate a unique payment number.",
            );
          }
        } else {
          throw error;
        }
      }
    }

    if (!payment) {
      throw new BadRequestException("Failed to create payment.");
    }

    return payment;
  }

  async findAll(query: QueryPaymentDto, user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PaymentWhereInput = {
      tenantId: user.tenantId!,
      deletedAt: null,
    };

    if (query.type) {
      where.type = query.type;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.paymentNumber) {
      where.paymentNumber = {
        contains: query.paymentNumber,
        mode: "insensitive",
      };
    }

    const sortField = query.sort || "createdAt";
    const order = query.order || "desc";

    const [totalItems, data] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        orderBy: { [sortField]: order },
        skip,
        take: limit,
        include: {
          allocations: {
            include: {
              invoice: true,
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

  async findOne(id: string, user: AuthUser): Promise<Payment> {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    const payment = await this.prisma.payment.findFirst({
      where: { id, tenantId: user.tenantId!, deletedAt: null },
      include: {
        allocations: {
          include: {
            invoice: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found.`);
    }

    return payment;
  }

  async update(
    id: string,
    dto: UpdatePaymentDto,
    user: AuthUser,
  ): Promise<Payment> {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    const tenantId = user.tenantId!;

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const payment = await tx.payment.findFirst({
        where: { id, tenantId, deletedAt: null },
      });

      if (!payment) {
        throw new NotFoundException(`Payment with ID ${id} not found.`);
      }

      if (payment.status !== PaymentStatus.DRAFT) {
        throw new BadRequestException(
          `Only DRAFT payments can be updated. Status is ${payment.status}`,
        );
      }

      if (payment.version !== dto.expectedVersion) {
        throw new ConflictException(
          `Optimistic concurrency lock failed. Expected version: ${payment.version}`,
        );
      }

      const type = dto.type || payment.type;
      const method = dto.method || payment.method;
      const paymentDate = dto.paymentDate || payment.paymentDate.toISOString();
      const paymentAmount =
        dto.amount !== undefined
          ? new Prisma.Decimal(dto.amount)
          : new Prisma.Decimal(payment.amount);

      let customerId = payment.customerId;
      let supplierName = payment.supplierName;

      if (type === PaymentType.RECEIPT) {
        const checkCustId = dto.customerId || payment.customerId;
        if (!checkCustId) {
          throw new BadRequestException(
            "customerId is required for Receipt payments.",
          );
        }
        if (dto.supplierName) {
          throw new BadRequestException(
            "supplierName must be null for Receipt payments.",
          );
        }
        const customer = await tx.customer.findFirst({
          where: { id: checkCustId, tenantId, deletedAt: null },
        });
        if (!customer) {
          throw new NotFoundException(`Customer ${checkCustId} not found.`);
        }
        customerId = checkCustId;
        supplierName = null;
      } else {
        const checkSupplier = dto.supplierName || payment.supplierName;
        if (!checkSupplier) {
          throw new BadRequestException(
            "supplierName is required for Disbursement payments.",
          );
        }
        if (dto.customerId) {
          throw new BadRequestException(
            "customerId must be null for Disbursement payments.",
          );
        }
        supplierName = checkSupplier;
        customerId = null;
      }

      let allocationsSum = new Prisma.Decimal(0);
      const invoiceAllocations: {
        invoiceId: string;
        allocatedAmount: Prisma.Decimal;
      }[] = [];

      if (dto.allocations) {
        await tx.paymentAllocation.deleteMany({
          where: { paymentId: id },
        });

        if (dto.allocations.length > 0) {
          const seenInvoiceIds = new Set<string>();

          for (const alloc of dto.allocations) {
            if (seenInvoiceIds.has(alloc.invoiceId)) {
              throw new BadRequestException(
                `Duplicate allocation for invoice ${alloc.invoiceId}.`,
              );
            }
            seenInvoiceIds.add(alloc.invoiceId);

            const allocAmount = new Prisma.Decimal(alloc.allocatedAmount);
            if (allocAmount.lte(0)) {
              throw new BadRequestException(
                "Allocation amount must be greater than zero.",
              );
            }

            const invoice = await tx.invoice.findFirst({
              where: { id: alloc.invoiceId, tenantId, deletedAt: null },
            });

            if (!invoice) {
              throw new NotFoundException(
                `Invoice ${alloc.invoiceId} not found.`,
              );
            }

            if (
              type === PaymentType.RECEIPT &&
              invoice.type !== InvoiceType.SALES
            ) {
              throw new BadRequestException(
                "Receipt payments can only target Sales invoices.",
              );
            }
            if (
              type === PaymentType.DISBURSEMENT &&
              invoice.type !== InvoiceType.PURCHASE
            ) {
              throw new BadRequestException(
                "Disbursement payments can only target Purchase invoices.",
              );
            }

            if (
              invoice.status === InvoiceStatus.DRAFT ||
              invoice.status === InvoiceStatus.CANCELLED
            ) {
              throw new BadRequestException(
                `Cannot allocate to a ${invoice.status} invoice.`,
              );
            }

            const outstanding = new Prisma.Decimal(invoice.grandTotal).sub(
              new Prisma.Decimal(invoice.amountPaid),
            );
            if (allocAmount.gt(outstanding)) {
              throw new BadRequestException(
                `Allocation ${allocAmount.toString()} exceeds outstanding balance of ${outstanding.toString()} for invoice ${invoice.invoiceNumber}.`,
              );
            }

            allocationsSum = allocationsSum.add(allocAmount);
            invoiceAllocations.push({
              invoiceId: alloc.invoiceId,
              allocatedAmount: allocAmount,
            });
          }
        }
      } else {
        // Reuse old allocations and validate against potentially updated payment amount
        const oldAllocations = await tx.paymentAllocation.findMany({
          where: { paymentId: id },
        });
        for (const o of oldAllocations) {
          allocationsSum = allocationsSum.add(
            new Prisma.Decimal(o.allocatedAmount),
          );
        }
      }

      if (allocationsSum.gt(paymentAmount)) {
        throw new BadRequestException(
          "Total allocated amount cannot exceed payment amount.",
        );
      }

      if (dto.allocations && invoiceAllocations.length > 0) {
        await tx.paymentAllocation.createMany({
          data: invoiceAllocations.map((a) => ({
            tenantId,
            paymentId: id,
            invoiceId: a.invoiceId,
            allocatedAmount: a.allocatedAmount,
          })),
        });
      }

      const updated = await tx.payment.update({
        where: { id },
        data: {
          type,
          method,
          referenceNumber:
            dto.referenceNumber !== undefined
              ? dto.referenceNumber
              : payment.referenceNumber,
          paymentDate: new Date(paymentDate),
          amount: paymentAmount,
          currency: dto.currency || payment.currency,
          notes: dto.notes !== undefined ? dto.notes : payment.notes,
          customerId,
          supplierName,
          version: payment.version + 1,
          updatedBy: user.id,
        },
        include: {
          allocations: true,
        },
      });

      await this.auditService.log(
        {
          action: "PAYMENT_UPDATED",
          entity: "Payment",
          entityId: id,
          oldValues: {
            amount: payment.amount.toString(),
            version: payment.version,
          },
          newValues: {
            amount: updated.amount.toString(),
            version: updated.version,
          },
        },
        tx,
      );

      return updated;
    });
  }

  async post(
    id: string,
    dto: PostPaymentDto,
    user: AuthUser,
  ): Promise<Payment> {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    const tenantId = user.tenantId!;

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const payment = await tx.payment.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: {
          allocations: true,
        },
      });

      if (!payment) {
        throw new NotFoundException(`Payment with ID ${id} not found.`);
      }

      if (payment.status !== PaymentStatus.DRAFT) {
        throw new BadRequestException(
          `Only DRAFT payments can be posted. Status is ${payment.status}`,
        );
      }

      if (payment.version !== dto.expectedVersion) {
        throw new ConflictException(
          `Optimistic concurrency lock failed. Expected version: ${payment.version}`,
        );
      }

      // Lock invoices deterministically to avoid deadlock
      const allocations = payment.allocations;
      const invoiceIds = allocations.map((a) => a.invoiceId).sort();

      for (const invId of invoiceIds) {
        await tx.$executeRaw`
          SELECT id FROM invoices WHERE id = ${invId}::uuid AND tenant_id = ${tenantId}::uuid FOR UPDATE
        `;
      }

      // Validate allocations again and update invoices
      for (const alloc of allocations) {
        const invoice = await tx.invoice.findFirst({
          where: { id: alloc.invoiceId, tenantId, deletedAt: null },
        });

        if (!invoice) {
          throw new NotFoundException(`Invoice ${alloc.invoiceId} not found.`);
        }

        if (
          invoice.status === InvoiceStatus.DRAFT ||
          invoice.status === InvoiceStatus.CANCELLED
        ) {
          throw new BadRequestException(
            `Cannot allocate to a ${invoice.status} invoice.`,
          );
        }

        const allocAmount = new Prisma.Decimal(alloc.allocatedAmount);
        const currentPaid = new Prisma.Decimal(invoice.amountPaid);
        const grandTotal = new Prisma.Decimal(invoice.grandTotal);

        const remaining = grandTotal.sub(currentPaid);
        if (allocAmount.gt(remaining)) {
          throw new BadRequestException(
            `Allocated amount ${allocAmount.toString()} exceeds remaining balance of ${remaining.toString()} on invoice ${invoice.invoiceNumber}.`,
          );
        }

        const nextPaid = currentPaid.add(allocAmount);
        const isFullyPaid = nextPaid.equals(grandTotal);
        const nextStatus = isFullyPaid
          ? InvoiceStatus.PAID
          : InvoiceStatus.PARTIALLY_PAID;

        const updatedInvoice = await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            amountPaid: nextPaid,
            status: nextStatus,
            version: invoice.version + 1,
            updatedBy: user.id,
          },
        });

        // Log Invoice Audit Log
        await this.auditService.log(
          {
            action: "INVOICE_PAYMENT_RECORDED",
            entity: "Invoice",
            entityId: invoice.id,
            oldValues: {
              amountPaid: invoice.amountPaid.toString(),
              status: invoice.status,
              version: invoice.version,
            },
            newValues: {
              amountPaid: updatedInvoice.amountPaid.toString(),
              status: updatedInvoice.status,
              version: updatedInvoice.version,
            },
          },
          tx,
        );

        // Emit Invoice Notification
        await this.notificationsService.createInternal({
          userId: invoice.createdBy,
          tenantId: invoice.tenantId,
          title: isFullyPaid
            ? "Invoice Fully Paid"
            : "Invoice Payment Recorded",
          message: isFullyPaid
            ? `Invoice ${invoice.invoiceNumber} has been fully settled.`
            : `A payment allocation of ${allocAmount.toString()} has been recorded for invoice ${invoice.invoiceNumber}.`,
          type: isFullyPaid ? NotificationType.SUCCESS : NotificationType.INFO,
        });
      }

      // Update payment status
      const updatedPayment = await tx.payment.update({
        where: { id },
        data: {
          status: PaymentStatus.POSTED,
          version: payment.version + 1,
          updatedBy: user.id,
        },
      });

      // Log Payment Audit
      await this.auditService.log(
        {
          action: "PAYMENT_POSTED",
          entity: "Payment",
          entityId: id,
          oldValues: {
            status: payment.status,
            version: payment.version,
          },
          newValues: {
            status: updatedPayment.status,
            version: updatedPayment.version,
          },
        },
        tx,
      );

      // Emit Payment Notification
      await this.notificationsService.createInternal({
        userId: payment.createdBy,
        tenantId: payment.tenantId,
        title: "Payment Posted",
        message: `Payment ${payment.paymentNumber} has been posted successfully.`,
        type: NotificationType.SUCCESS,
      });

      // Automated GL Journal Entry Creation
      const isReceipt = payment.type === PaymentType.RECEIPT;
      const lines = isReceipt
        ? [
            { code: "1010", debit: Number(payment.amount), credit: 0 },
            { code: "1200", debit: 0, credit: Number(payment.amount) },
          ]
        : [
            { code: "2000", debit: Number(payment.amount), credit: 0 },
            { code: "1010", debit: 0, credit: Number(payment.amount) },
          ];
      await this.accountingService.automatedPost(
        tx,
        JournalSourceType.PAYMENT,
        payment.id,
        `Payment posted: ${payment.paymentNumber}`,
        lines,
        { id: user.id, tenantId },
      );

      return updatedPayment;
    });
  }

  async reverse(
    id: string,
    dto: ReversePaymentDto,
    user: AuthUser,
  ): Promise<Payment> {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }

    const tenantId = user.tenantId!;

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const payment = await tx.payment.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: {
          allocations: true,
        },
      });

      if (!payment) {
        throw new NotFoundException(`Payment with ID ${id} not found.`);
      }

      if (payment.status !== PaymentStatus.POSTED) {
        throw new BadRequestException(
          `Only POSTED payments can be reversed. Current status is ${payment.status}`,
        );
      }

      if (payment.version !== dto.expectedVersion) {
        throw new ConflictException(
          `Optimistic concurrency lock failed. Expected version: ${payment.version}`,
        );
      }

      // Lock invoices deterministically to avoid deadlock
      const allocations = payment.allocations;
      const invoiceIds = allocations.map((a) => a.invoiceId).sort();

      for (const invId of invoiceIds) {
        await tx.$executeRaw`
          SELECT id FROM invoices WHERE id = ${invId}::uuid AND tenant_id = ${tenantId}::uuid FOR UPDATE
        `;
      }

      // Revert allocations and invoice status
      for (const alloc of allocations) {
        const invoice = await tx.invoice.findFirst({
          where: { id: alloc.invoiceId, tenantId, deletedAt: null },
        });

        if (!invoice) {
          throw new NotFoundException(`Invoice ${alloc.invoiceId} not found.`);
        }

        const allocAmount = new Prisma.Decimal(alloc.allocatedAmount);
        const currentPaid = new Prisma.Decimal(invoice.amountPaid);

        if (allocAmount.gt(currentPaid)) {
          throw new BadRequestException(
            `Reversal fails: payment allocation amount ${allocAmount.toString()} exceeds recorded paid amount ${currentPaid.toString()} on invoice ${invoice.invoiceNumber}.`,
          );
        }

        const nextPaid = currentPaid.sub(allocAmount);
        const nextStatus = nextPaid.equals(0)
          ? InvoiceStatus.ISSUED
          : InvoiceStatus.PARTIALLY_PAID;

        const updatedInvoice = await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            amountPaid: nextPaid,
            status: nextStatus,
            version: invoice.version + 1,
            updatedBy: user.id,
          },
        });

        // Log Invoice Reversal Audit
        await this.auditService.log(
          {
            action: "INVOICE_PAYMENT_REVERSED",
            entity: "Invoice",
            entityId: invoice.id,
            oldValues: {
              amountPaid: invoice.amountPaid.toString(),
              status: invoice.status,
              version: invoice.version,
            },
            newValues: {
              amountPaid: updatedInvoice.amountPaid.toString(),
              status: updatedInvoice.status,
              version: updatedInvoice.version,
            },
          },
          tx,
        );

        // Emit Warning Notification
        await this.notificationsService.createInternal({
          userId: invoice.createdBy,
          tenantId: invoice.tenantId,
          title: "Invoice Payment Reversed",
          message: `The payment allocation of ${allocAmount.toString()} has been reversed for invoice ${invoice.invoiceNumber}.`,
          type: NotificationType.WARNING,
        });
      }

      // Update payment status
      const updatedPayment = await tx.payment.update({
        where: { id },
        data: {
          status: PaymentStatus.REVERSED,
          version: payment.version + 1,
          updatedBy: user.id,
        },
      });

      // Log Payment Audit
      await this.auditService.log(
        {
          action: "PAYMENT_REVERSED",
          entity: "Payment",
          entityId: id,
          oldValues: {
            status: payment.status,
            version: payment.version,
          },
          newValues: {
            status: updatedPayment.status,
            version: updatedPayment.version,
          },
        },
        tx,
      );

      // Emit Warning Notification
      await this.notificationsService.createInternal({
        userId: payment.createdBy,
        tenantId: payment.tenantId,
        title: "Payment Reversed",
        message: `Payment ${payment.paymentNumber} has been reversed.`,
        type: NotificationType.WARNING,
      });

      // Automated GL Journal Entry Reversal Creation
      const isReceipt = payment.type === PaymentType.RECEIPT;
      const lines = isReceipt
        ? [
            { code: "1200", debit: Number(payment.amount), credit: 0 },
            { code: "1010", debit: 0, credit: Number(payment.amount) },
          ]
        : [
            { code: "1010", debit: Number(payment.amount), credit: 0 },
            { code: "2000", debit: 0, credit: Number(payment.amount) },
          ];
      await this.accountingService.automatedPost(
        tx,
        JournalSourceType.PAYMENT,
        payment.id,
        `Payment reversed: ${payment.paymentNumber}`,
        lines,
        { id: user.id, tenantId },
      );

      return updatedPayment;
    });
  }
}
