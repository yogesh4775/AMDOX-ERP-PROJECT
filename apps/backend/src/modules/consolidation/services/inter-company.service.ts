import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { AuditService } from "../../../common/audit/audit.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { CreateInterCompanyDto } from "../dto/create-intercompany.dto";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";

@Injectable()
export class InterCompanyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createInterCompanyTransaction(
    tenantId: string,
    dto: CreateInterCompanyDto,
    user: AuthUser,
  ) {
    // Validate companies
    const fromComp = await this.prisma.company.findFirst({
      where: { tenantId, id: dto.fromCompanyId },
    });
    const toComp = await this.prisma.company.findFirst({
      where: { tenantId, id: dto.toCompanyId },
    });

    if (!fromComp || !toComp) {
      throw new NotFoundException("One or both companies not found.");
    }

    const tx = await this.prisma.interCompanyTransaction.create({
      data: {
        tenantId,
        fromCompanyId: dto.fromCompanyId,
        toCompanyId: dto.toCompanyId,
        type: dto.type,
        amount: dto.amount,
        currency: dto.currency,
        referenceType: dto.referenceType || null,
        referenceId: dto.referenceId || null,
        transferPricingMarkup: dto.transferPricingMarkup || 0,
      },
    });

    await this.auditService.log({
      action: "INTERCOMPANY_CREATED",
      entity: "InterCompanyTransaction",
      entityId: tx.id,
      newValues: tx,
      userId: user.id,
      tenantId,
    });

    // Run async cross-company approvals integration simulation
    // Standard workflows hook
    return tx;
  }

  async settleTransaction(tenantId: string, id: string, user: AuthUser) {
    const tx = await this.prisma.interCompanyTransaction.findFirst({
      where: { tenantId, id },
    });

    if (!tx) {
      throw new NotFoundException("Inter-company transaction not found.");
    }

    if (tx.status === "SETTLED") {
      throw new BadRequestException("Transaction is already settled.");
    }

    const updated = await this.prisma.interCompanyTransaction.update({
      where: { id },
      data: {
        status: "SETTLED",
        version: { increment: 1 },
      },
    });

    // Audit logs settlement
    await this.auditService.log({
      action: "INTERCOMPANY_SETTLED",
      entity: "InterCompanyTransaction",
      entityId: tx.id,
      newValues: { id, status: "SETTLED" },
      userId: user.id,
      tenantId,
    });

    return updated;
  }

  async triggerAutoInterCompanyPurchase(
    tenantId: string,
    salesOrderId: string,
    user: AuthUser,
  ) {
    // Asynchronously find the SalesOrder
    const salesOrder = await this.prisma.salesOrder.findFirst({
      where: { tenantId, id: salesOrderId },
      include: { items: true },
    });

    if (!salesOrder) {
      throw new NotFoundException(`Sales order ${salesOrderId} not found.`);
    }

    // Auto trigger Intercompany Purchase Order creation
    // Find counterpart subsidiary (for this test, let's look up another company)
    const counterpartCompany = await this.prisma.company.findFirst({
      where: {
        tenantId,
        isConsolidationEntity: false,
        id: { not: salesOrder.companyId || undefined },
      },
    });

    if (!counterpartCompany) {
      return; // No counterpart company registered, skip PO generation
    }

    // Construct inter-company transaction record
    const interCompanyTx = await this.createInterCompanyTransaction(
      tenantId,
      {
        fromCompanyId: salesOrder.companyId || "",
        toCompanyId: counterpartCompany.id,
        type: "SALE_PURCHASE",
        amount: Number(salesOrder.totalAmount),
        currency: "USD",
        referenceType: "SALES_ORDER",
        referenceId: salesOrder.id,
        transferPricingMarkup: 10.0, // Default 10% transfer pricing markup
      },
      user,
    );

    // Create the counterpart Purchase Order
    const poNumber = `ICPO-${Date.now()}`;
    const purchaseOrder = await this.prisma.purchaseOrder.create({
      data: {
        tenantId,
        supplierName: "Intercompany Partner",
        orderNumber: poNumber,
        status: "APPROVED",
        expectedDeliveryDate: new Date(),
        totalAmount: salesOrder.totalAmount,
        createdBy: user.id,
        companyId: counterpartCompany.id,
      },
    });

    // Create matching PO items
    for (const item of salesOrder.items) {
      await this.prisma.purchaseOrderItem.create({
        data: {
          tenantId,
          purchaseOrderId: purchaseOrder.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        },
      });
    }

    return {
      interCompanyTx,
      purchaseOrder,
    };
  }
}
