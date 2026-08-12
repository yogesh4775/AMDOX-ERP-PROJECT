import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { AuditService } from "../../../common/audit/audit.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { StockService } from "../../inventory/stock.service";
import {
  TransactionHelper,
  PrismaTx,
} from "../../../common/transactions/transaction.helper";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";
import {
  CreateSamplingPlanDto,
  UpdateSamplingPlanDto,
} from "../dto/sampling-plan.dto";
import {
  CreateInspectionPlanDto,
  UpdateInspectionPlanDto,
} from "../dto/inspection-plan.dto";
import {
  CreateInspectionLotDto,
  UpdateInspectionLotDto,
} from "../dto/inspection-lot.dto";
import { RecordInspectionResultsDto } from "../dto/inspection-result.dto";
import { RecordDefectDto } from "../dto/defect.dto";
import { UpdateNCRDto } from "../dto/ncr.dto";
import { CreateCAPADto, UpdateCAPADto } from "../dto/capa.dto";
import { CreateCertificateDto } from "../dto/certificate.dto";
import {
  Prisma,
  SamplingPlan,
  InspectionPlan,
  InspectionLot,
  QualityDefect,
  NonConformanceReport,
  CorrectiveAction,
  SupplierQualityRating,
  QualityCertificate,
  InspectionLotStatus,
  InspectionLotType,
  NCROutcome,
  AccountType,
  Warehouse,
  JournalSourceType,
} from "@amdox/database/generated";
import { NotificationType } from "../../notifications/dto/query-notification.dto";
import * as crypto from "crypto";

@Injectable()
export class QualityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly stockService: StockService,
    private readonly transactionHelper: TransactionHelper,
  ) {}

  // --- SAMPLING PLAN CRUD ---
  async createSamplingPlan(
    dto: CreateSamplingPlanDto,
    user: AuthUser,
  ): Promise<SamplingPlan> {
    const tenantId = user.tenantId;
    if (!tenantId) throw new ForbiddenException("Tenant ID is required.");

    if (dto.lotSizeMin > dto.lotSizeMax) {
      throw new BadRequestException(
        "Lot size minimum cannot be greater than maximum.",
      );
    }
    if (dto.acceptNumber >= dto.rejectNumber) {
      throw new BadRequestException(
        "Accept number must be less than reject number.",
      );
    }

    return this.transactionHelper.run(async (tx) => {
      const existing = await tx.samplingPlan.findFirst({
        where: { tenantId, code: dto.code, deletedAt: null },
      });
      if (existing) {
        throw new ConflictException(
          `Sampling plan with code ${dto.code} already exists.`,
        );
      }

      const plan = await tx.samplingPlan.create({
        data: {
          tenantId,
          code: dto.code,
          name: dto.name,
          aql: dto.aql,
          lotSizeMin: dto.lotSizeMin,
          lotSizeMax: dto.lotSizeMax,
          sampleSize: dto.sampleSize,
          acceptNumber: dto.acceptNumber,
          rejectNumber: dto.rejectNumber,
        },
      });

      await this.auditService.log(
        {
          action: "SAMPLING_PLAN_CREATED",
          entity: "SamplingPlan",
          entityId: plan.id,
          newValues: plan,
        },
        tx,
      );

      return plan;
    });
  }

  async updateSamplingPlan(
    id: string,
    dto: UpdateSamplingPlanDto,
    user: AuthUser,
  ): Promise<SamplingPlan> {
    const tenantId = user.tenantId;
    if (!tenantId) throw new ForbiddenException("Tenant ID is required.");

    return this.transactionHelper.run(async (tx) => {
      const plan = await tx.samplingPlan.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
      if (!plan) throw new NotFoundException(`Sampling plan not found.`);

      const updated = await tx.samplingPlan.update({
        where: { id },
        data: {
          name: dto.name,
          aql: dto.aql,
          lotSizeMin: dto.lotSizeMin,
          lotSizeMax: dto.lotSizeMax,
          sampleSize: dto.sampleSize,
          acceptNumber: dto.acceptNumber,
          rejectNumber: dto.rejectNumber,
          version: { increment: 1 },
        },
      });

      if (updated.lotSizeMin > updated.lotSizeMax) {
        throw new BadRequestException(
          "Lot size minimum cannot be greater than maximum.",
        );
      }
      if (updated.acceptNumber >= updated.rejectNumber) {
        throw new BadRequestException(
          "Accept number must be less than reject number.",
        );
      }

      return updated;
    });
  }

  async findAllSamplingPlans(user: AuthUser): Promise<SamplingPlan[]> {
    const tenantId = user.tenantId;
    if (!tenantId) throw new ForbiddenException("Tenant ID is required.");
    return this.prisma.samplingPlan.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
  }

  async deleteSamplingPlan(id: string, user: AuthUser): Promise<SamplingPlan> {
    const tenantId = user.tenantId;
    if (!tenantId) throw new ForbiddenException("Tenant ID is required.");

    return this.transactionHelper.run(async (tx) => {
      const plan = await tx.samplingPlan.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
      if (!plan) throw new NotFoundException(`Sampling plan not found.`);

      return tx.samplingPlan.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });
  }

  // --- INSPECTION PLAN CRUD ---
  async createInspectionPlan(
    dto: CreateInspectionPlanDto,
    user: AuthUser,
  ): Promise<InspectionPlan> {
    const tenantId = user.tenantId;
    if (!tenantId) throw new ForbiddenException("Tenant ID is required.");

    return this.transactionHelper.run(async (tx) => {
      const existing = await tx.inspectionPlan.findFirst({
        where: { tenantId, code: dto.code, deletedAt: null },
      });
      if (existing) {
        throw new ConflictException(
          `Inspection plan with code ${dto.code} already exists.`,
        );
      }

      const product = await tx.product.findFirst({
        where: { id: dto.productId, tenantId, deletedAt: null },
      });
      if (!product) throw new NotFoundException("Product not found.");

      if (dto.samplingPlanId) {
        const sp = await tx.samplingPlan.findFirst({
          where: { id: dto.samplingPlanId, tenantId, deletedAt: null },
        });
        if (!sp) throw new NotFoundException("Sampling plan not found.");
      }

      const plan = await tx.inspectionPlan.create({
        data: {
          tenantId,
          productId: dto.productId,
          code: dto.code,
          name: dto.name,
          samplingPlanId: dto.samplingPlanId,
          status: "ACTIVE",
          characteristics: {
            create: dto.characteristics.map((c) => ({
              tenantId,
              sequence: c.sequence,
              name: c.name,
              description: c.description,
              type: c.type,
              upperLimit: c.upperLimit,
              lowerLimit: c.lowerLimit,
              unit: c.unit,
              isRequired: c.isRequired ?? true,
            })),
          },
        },
        include: { characteristics: true },
      });

      await this.auditService.log(
        {
          action: "INSPECTION_PLAN_CREATED",
          entity: "InspectionPlan",
          entityId: plan.id,
          newValues: plan,
        },
        tx,
      );

      return plan;
    });
  }

  async updateInspectionPlan(
    id: string,
    dto: UpdateInspectionPlanDto,
    user: AuthUser,
  ): Promise<InspectionPlan> {
    const tenantId = user.tenantId;
    if (!tenantId) throw new ForbiddenException("Tenant ID is required.");

    return this.transactionHelper.run(async (tx) => {
      const plan = await tx.inspectionPlan.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
      if (!plan) throw new NotFoundException("Inspection plan not found.");

      if (dto.samplingPlanId) {
        const sp = await tx.samplingPlan.findFirst({
          where: { id: dto.samplingPlanId, tenantId, deletedAt: null },
        });
        if (!sp) throw new NotFoundException("Sampling plan not found.");
      }

      return tx.inspectionPlan.update({
        where: { id },
        data: {
          name: dto.name,
          status: dto.status,
          samplingPlanId: dto.samplingPlanId,
          version: { increment: 1 },
        },
        include: { characteristics: true },
      });
    });
  }

  async findAllInspectionPlans(user: AuthUser): Promise<InspectionPlan[]> {
    const tenantId = user.tenantId;
    if (!tenantId) throw new ForbiddenException("Tenant ID is required.");
    return this.prisma.inspectionPlan.findMany({
      where: { tenantId, deletedAt: null },
      include: { characteristics: true, product: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOneInspectionPlan(
    id: string,
    user: AuthUser,
  ): Promise<InspectionPlan> {
    const tenantId = user.tenantId;
    if (!tenantId) throw new ForbiddenException("Tenant ID is required.");
    const plan = await this.prisma.inspectionPlan.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { characteristics: true, product: true },
    });
    if (!plan) throw new NotFoundException("Inspection plan not found.");
    return plan;
  }

  async deleteInspectionPlan(
    id: string,
    user: AuthUser,
  ): Promise<InspectionPlan> {
    const tenantId = user.tenantId;
    if (!tenantId) throw new ForbiddenException("Tenant ID is required.");

    return this.transactionHelper.run(async (tx) => {
      const plan = await tx.inspectionPlan.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
      if (!plan) throw new NotFoundException("Inspection plan not found.");

      return tx.inspectionPlan.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });
  }

  // --- INSPECTION LOT CRUD & ENGINE ---
  async createInspectionLot(
    dto: CreateInspectionLotDto,
    user: AuthUser,
  ): Promise<InspectionLot> {
    const tenantId = user.tenantId;
    if (!tenantId) throw new ForbiddenException("Tenant ID is required.");

    return this.transactionHelper.run(async (tx) => {
      return this.createInspectionLotInternal(
        tx,
        {
          tenantId,
          code: dto.code,
          productId: dto.productId,
          type: dto.type,
          quantity: dto.quantity,
          warehouseId: dto.warehouseId,
          purchaseReceiptId: dto.purchaseReceiptId,
          workOrderId: dto.workOrderId,
          inspectionPlanId: dto.inspectionPlanId,
        },
        user.id,
      );
    });
  }

  async createInspectionLotInternal(
    tx: PrismaTx,
    data: {
      tenantId: string;
      code: string;
      productId: string;
      type: InspectionLotType;
      quantity: number;
      warehouseId: string;
      purchaseReceiptId?: string;
      workOrderId?: string;
      inspectionPlanId?: string;
    },
    userId: string,
  ): Promise<InspectionLot> {
    const existing = await tx.inspectionLot.findFirst({
      where: { tenantId: data.tenantId, code: data.code, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException(
        `Inspection lot with code ${data.code} already exists.`,
      );
    }

    const product = await tx.product.findFirst({
      where: { id: data.productId, tenantId: data.tenantId, deletedAt: null },
    });
    if (!product) throw new NotFoundException("Product not found.");

    const warehouse = await tx.warehouse.findFirst({
      where: { id: data.warehouseId, tenantId: data.tenantId, deletedAt: null },
    });
    if (!warehouse) throw new NotFoundException("Warehouse not found.");

    let sampleSize = 1;
    let planId = data.inspectionPlanId;

    if (!planId) {
      // Automatically find active plan for product
      const activePlan = await tx.inspectionPlan.findFirst({
        where: {
          tenantId: data.tenantId,
          productId: data.productId,
          status: "ACTIVE",
          deletedAt: null,
        },
      });
      if (activePlan) {
        planId = activePlan.id;
      }
    }

    if (planId) {
      const plan = await tx.inspectionPlan.findUnique({
        where: { id: planId },
        include: { samplingPlan: true },
      });
      if (plan && plan.samplingPlan) {
        const sp = plan.samplingPlan;
        if (data.quantity >= sp.lotSizeMin && data.quantity <= sp.lotSizeMax) {
          sampleSize = sp.sampleSize;
        }
      }
    }

    const lot = await tx.inspectionLot.create({
      data: {
        tenantId: data.tenantId,
        code: data.code,
        productId: data.productId,
        type: data.type,
        status: "PENDING",
        quantity: data.quantity,
        sampleSize,
        warehouseId: data.warehouseId,
        purchaseReceiptId: data.purchaseReceiptId,
        workOrderId: data.workOrderId,
        inspectionPlanId: planId,
      },
    });

    const holdWh = await this.getOrCreateHoldWarehouse(
      tx,
      data.tenantId,
      warehouse,
    );
    await this.stockService.mutateStock(
      tx as unknown as Prisma.TransactionClient,
      data.tenantId,
      warehouse.id,
      data.productId,
      "STOCK_OUT",
      -Number(data.quantity),
      "STOCK_MOVEMENT",
      lot.id,
      userId,
      `Move stock to Hold for Quality inspection lot ${data.code}`,
    );

    await this.stockService.mutateStock(
      tx as unknown as Prisma.TransactionClient,
      data.tenantId,
      holdWh.id,
      data.productId,
      "STOCK_IN",
      Number(data.quantity),
      "STOCK_MOVEMENT",
      lot.id,
      userId,
      `Quality Hold addition for lot ${data.code}`,
    );

    await this.auditService.log(
      {
        action: "INSPECTION_CREATED",
        entity: "InspectionLot",
        entityId: lot.id,
        newValues: lot,
      },
      tx,
    );

    await this.notificationsService.createInternal(
      {
        userId,
        tenantId: data.tenantId,
        title: "Quality Inspection Lot Created",
        message: `Inspection lot ${lot.code} created for Product SKU: ${product.sku} (Qty: ${data.quantity}). Please record results.`,
        type: NotificationType.INFO,
      },
      tx,
    );

    return lot;
  }

  async updateInspectionLot(
    id: string,
    dto: UpdateInspectionLotDto,
    user: AuthUser,
  ): Promise<InspectionLot> {
    const tenantId = user.tenantId;
    if (!tenantId) throw new ForbiddenException("Tenant ID is required.");

    return this.transactionHelper.run(async (tx) => {
      const lot = await tx.inspectionLot.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
      if (!lot) throw new NotFoundException("Inspection lot not found.");

      return tx.inspectionLot.update({
        where: { id },
        data: {
          status: dto.status,
          version: { increment: 1 },
        },
      });
    });
  }

  async findAllInspectionLots(user: AuthUser): Promise<InspectionLot[]> {
    const tenantId = user.tenantId;
    if (!tenantId) throw new ForbiddenException("Tenant ID is required.");
    return this.prisma.inspectionLot.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        product: true,
        warehouse: true,
        plan: { include: { characteristics: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOneInspectionLot(
    id: string,
    user: AuthUser,
  ): Promise<InspectionLot> {
    const tenantId = user.tenantId;
    if (!tenantId) throw new ForbiddenException("Tenant ID is required.");
    const lot = await this.prisma.inspectionLot.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        product: true,
        warehouse: true,
        results: true,
        defects: true,
        ncrs: true,
      },
    });
    if (!lot) throw new NotFoundException("Inspection lot not found.");
    return lot;
  }

  // --- RECORD RESULTS & DISPOSITION ---
  async recordInspectionResults(
    id: string,
    dto: RecordInspectionResultsDto,
    user: AuthUser,
  ): Promise<InspectionLot> {
    const tenantId = user.tenantId;
    if (!tenantId) throw new ForbiddenException("Tenant ID is required.");

    return this.transactionHelper.run(async (tx) => {
      const lot = await tx.inspectionLot.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: {
          plan: { include: { characteristics: true } },
          warehouse: true,
        },
      });
      if (!lot) throw new NotFoundException("Inspection lot not found.");
      if (lot.status !== "PENDING" && lot.status !== "IN_PROGRESS") {
        throw new BadRequestException(
          `Inspection results cannot be recorded for lot with status: ${lot.status}`,
        );
      }

      if (!lot.inspectionPlanId) {
        throw new BadRequestException(
          "This inspection lot does not have a designated inspection plan.",
        );
      }

      // Record results in database, ensuring no duplicate results
      for (const res of dto.results) {
        const char = lot.plan?.characteristics.find(
          (c) => c.id === res.characteristicId,
        );
        if (!char) {
          throw new BadRequestException(
            `Characteristic ${res.characteristicId} is not part of this inspection plan.`,
          );
        }

        // Prevent duplicate results
        await tx.inspectionResult.upsert({
          where: {
            inspectionLotId_characteristicId: {
              inspectionLotId: lot.id,
              characteristicId: res.characteristicId,
            },
          },
          update: {
            measuredValue: res.measuredValue,
            passed: res.passed,
            remarks: res.remarks,
            inspectedBy: user.id,
          },
          create: {
            tenantId,
            inspectionLotId: lot.id,
            characteristicId: res.characteristicId,
            measuredValue: res.measuredValue,
            passed: res.passed,
            remarks: res.remarks,
            inspectedBy: user.id,
          },
        });
      }

      // Fetch all recorded results to calculate completion
      const dbResults = await tx.inspectionResult.findMany({
        where: { inspectionLotId: lot.id },
      });

      const requiredChars =
        lot.plan?.characteristics.filter((c) => c.isRequired) || [];
      const allRequiredRecorded = requiredChars.every((rc) =>
        dbResults.some((dr) => dr.characteristicId === rc.id),
      );

      let lotStatus: InspectionLotStatus = "IN_PROGRESS";

      if (
        allRequiredRecorded &&
        dbResults.length >= (lot.plan?.characteristics.length || 0)
      ) {
        const anyFailed = dbResults.some((dr) => !dr.passed);
        lotStatus = anyFailed ? "FAILED" : "PASSED";
      }

      const updatedLot = await tx.inspectionLot.update({
        where: { id: lot.id },
        data: {
          status: lotStatus,
          version: { increment: 1 },
        },
      });

      await this.auditService.log(
        {
          action:
            lotStatus === "IN_PROGRESS"
              ? "INSPECTION_IN_PROGRESS"
              : "INSPECTION_COMPLETED",
          entity: "InspectionLot",
          entityId: lot.id,
          newValues: { status: lotStatus },
        },
        tx,
      );

      if (lotStatus === "PASSED") {
        const holdWh = await this.getOrCreateHoldWarehouse(
          tx,
          tenantId,
          lot.warehouse,
        );
        await this.stockService.mutateStock(
          tx as unknown as Prisma.TransactionClient,
          tenantId,
          holdWh.id,
          lot.productId,
          "STOCK_OUT",
          -Number(lot.quantity),
          "STOCK_MOVEMENT",
          lot.id,
          user.id,
          `Release stock from Hold for passed inspection lot ${lot.code}`,
        );

        await this.stockService.mutateStock(
          tx as unknown as Prisma.TransactionClient,
          tenantId,
          lot.warehouseId,
          lot.productId,
          "STOCK_IN",
          Number(lot.quantity),
          "STOCK_MOVEMENT",
          lot.id,
          user.id,
          `Available stock released for lot ${lot.code}`,
        );

        if (lot.type === "INCOMING" && lot.purchaseReceiptId) {
          await this.updateSupplierRating(
            tx,
            tenantId,
            lot.purchaseReceiptId,
            true,
          );
        }

        await this.notificationsService.createInternal(
          {
            userId: user.id,
            tenantId,
            title: "Inspection Lot Passed",
            message: `Inspection lot ${lot.code} has passed quality testing. Stock released to main inventory.`,
            type: NotificationType.SUCCESS,
          },
          tx,
        );
      } else if (lotStatus === "FAILED") {
        const ncrCode = `NCR-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;
        const ncr = await tx.nonConformanceReport.create({
          data: {
            tenantId,
            code: ncrCode,
            inspectionLotId: lot.id,
            productId: lot.productId,
            source: lot.type,
            description: `Quality inspection failure on lot ${lot.code}`,
            status: "OPEN",
          },
        });

        await this.auditService.log(
          {
            action: "NCR_CREATED",
            entity: "NonConformanceReport",
            entityId: ncr.id,
            newValues: ncr,
          },
          tx,
        );

        if (lot.type === "INCOMING" && lot.purchaseReceiptId) {
          await this.updateSupplierRating(
            tx,
            tenantId,
            lot.purchaseReceiptId,
            false,
          );
        }

        const holdWh = await this.getOrCreateHoldWarehouse(
          tx,
          tenantId,
          lot.warehouse,
        );
        const rejectedWh = await this.getOrCreateRejectedWarehouse(
          tx,
          tenantId,
          lot.warehouse,
        );
        await this.stockService.mutateStock(
          tx as unknown as Prisma.TransactionClient,
          tenantId,
          holdWh.id,
          lot.productId,
          "STOCK_OUT",
          -Number(lot.quantity),
          "STOCK_MOVEMENT",
          lot.id,
          user.id,
          `Move failed quality hold stock to Rejected warehouse for lot ${lot.code}`,
        );

        await this.stockService.mutateStock(
          tx as unknown as Prisma.TransactionClient,
          tenantId,
          rejectedWh.id,
          lot.productId,
          "STOCK_IN",
          Number(lot.quantity),
          "STOCK_MOVEMENT",
          lot.id,
          user.id,
          `Quarantined rejected stock for lot ${lot.code}`,
        );

        await this.notificationsService.createInternal(
          {
            userId: user.id,
            tenantId,
            title: "Inspection Failed - NCR Generated",
            message: `Inspection lot ${lot.code} failed quality testing. Non-Conformance Report ${ncr.code} generated.`,
            type: NotificationType.WARNING,
          },
          tx,
        );
      }

      return updatedLot;
    });
  }

  async recordDefect(
    id: string,
    dto: RecordDefectDto,
    user: AuthUser,
  ): Promise<QualityDefect> {
    const tenantId = user.tenantId;
    if (!tenantId) throw new ForbiddenException("Tenant ID is required.");

    return this.transactionHelper.run(async (tx) => {
      const lot = await tx.inspectionLot.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
      if (!lot) throw new NotFoundException("Inspection lot not found.");

      const defect = await tx.qualityDefect.create({
        data: {
          tenantId,
          inspectionLotId: lot.id,
          code: dto.code,
          description: dto.description,
          severity: dto.severity,
          quantity: dto.quantity,
        },
      });

      return defect;
    });
  }

  // --- NCR DISPOSITION & ROOT CAUSE ---
  async findAllNCRs(user: AuthUser): Promise<NonConformanceReport[]> {
    const tenantId = user.tenantId;
    if (!tenantId) throw new ForbiddenException("Tenant ID is required.");
    return this.prisma.nonConformanceReport.findMany({
      where: { tenantId, deletedAt: null },
      include: { product: true, lot: true, capas: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOneNCR(id: string, user: AuthUser): Promise<NonConformanceReport> {
    const tenantId = user.tenantId;
    if (!tenantId) throw new ForbiddenException("Tenant ID is required.");
    const ncr = await this.prisma.nonConformanceReport.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        product: true,
        lot: { include: { warehouse: true } },
        capas: true,
      },
    });
    if (!ncr) throw new NotFoundException("Non-Conformance Report not found.");
    return ncr;
  }

  async updateNCR(
    id: string,
    dto: UpdateNCRDto,
    user: AuthUser,
  ): Promise<NonConformanceReport> {
    const tenantId = user.tenantId;
    if (!tenantId) throw new ForbiddenException("Tenant ID is required.");

    return this.transactionHelper.run(async (tx) => {
      const ncr = await tx.nonConformanceReport.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: { lot: { include: { warehouse: true } } },
      });
      if (!ncr) throw new NotFoundException("NCR not found.");

      const updated = await tx.nonConformanceReport.update({
        where: { id },
        data: {
          actionTaken: dto.actionTaken,
          status: dto.status,
          version: { increment: 1 },
        },
      });

      if (dto.actionTaken && dto.actionTaken !== ncr.actionTaken) {
        await this.handleNCRDispositionPostings(
          tx,
          tenantId,
          ncr,
          dto.actionTaken,
          user.id,
        );
      }

      return updated;
    });
  }

  private async handleNCRDispositionPostings(
    tx: PrismaTx,
    tenantId: string,
    ncr: NonConformanceReport & {
      lot: (InspectionLot & { warehouse: Warehouse }) | null;
    },
    action: NCROutcome,
    userId: string,
  ) {
    if (!ncr.lot) return;

    const lot = ncr.lot;
    const quantity = Number(lot.quantity);
    const product = await tx.product.findUnique({
      where: { id: lot.productId },
    });
    if (!product) return;
    const costPrice = Number(product.costPrice);
    const totalCost = costPrice * quantity;

    const rejectedWh = await this.getOrCreateRejectedWarehouse(
      tx,
      tenantId,
      lot.warehouse,
    );

    if (action === "SCRAP") {
      await this.stockService.mutateStock(
        tx as unknown as Prisma.TransactionClient,
        tenantId,
        rejectedWh.id,
        lot.productId,
        "STOCK_OUT",
        -quantity,
        "STOCK_MOVEMENT",
        ncr.id,
        userId,
        `Scrap disposition for NCR ${ncr.code}`,
      );

      await this.postQualityJournalEntry(
        tx,
        tenantId,
        lot.id,
        `SCRAP-${ncr.code}`,
        `Scrap cost write-off for NCR ${ncr.code} (Qty: ${quantity})`,
        "5500",
        "Scrap Expense",
        AccountType.EXPENSE,
        "1400",
        "Inventory",
        AccountType.ASSET,
        totalCost,
      );
    } else if (action === "REWORK") {
      const reworkWh = await this.getOrCreateReworkWarehouse(
        tx,
        tenantId,
        lot.warehouse,
      );
      await this.stockService.mutateStock(
        tx as unknown as Prisma.TransactionClient,
        tenantId,
        rejectedWh.id,
        lot.productId,
        "STOCK_OUT",
        -quantity,
        "STOCK_MOVEMENT",
        ncr.id,
        userId,
        `Transfer to Rework for NCR ${ncr.code}`,
      );

      await this.stockService.mutateStock(
        tx as unknown as Prisma.TransactionClient,
        tenantId,
        reworkWh.id,
        lot.productId,
        "STOCK_IN",
        quantity,
        "STOCK_MOVEMENT",
        ncr.id,
        userId,
        `Stock received in Rework warehouse for NCR ${ncr.code}`,
      );

      await this.postQualityJournalEntry(
        tx,
        tenantId,
        lot.id,
        `RWK-${ncr.code}`,
        `Rework cost posting for NCR ${ncr.code}`,
        "5600",
        "Rework Expense",
        AccountType.EXPENSE,
        "1410",
        "Work In Progress",
        AccountType.ASSET,
        totalCost,
      );
    } else if (action === "USE_AS_IS") {
      await this.stockService.mutateStock(
        tx as unknown as Prisma.TransactionClient,
        tenantId,
        rejectedWh.id,
        lot.productId,
        "STOCK_OUT",
        -quantity,
        "STOCK_MOVEMENT",
        ncr.id,
        userId,
        `Use as-is release for NCR ${ncr.code}`,
      );

      await this.stockService.mutateStock(
        tx as unknown as Prisma.TransactionClient,
        tenantId,
        lot.warehouseId,
        lot.productId,
        "STOCK_IN",
        quantity,
        "STOCK_MOVEMENT",
        ncr.id,
        userId,
        `Available stock released from NCR ${ncr.code}`,
      );
    } else if (action === "RETURN_TO_SUPPLIER") {
      await this.stockService.mutateStock(
        tx as unknown as Prisma.TransactionClient,
        tenantId,
        rejectedWh.id,
        lot.productId,
        "STOCK_OUT",
        -quantity,
        "STOCK_MOVEMENT",
        ncr.id,
        userId,
        `Return to supplier disposition for NCR ${ncr.code}`,
      );

      await this.postQualityJournalEntry(
        tx,
        tenantId,
        lot.id,
        `RTS-${ncr.code}`,
        `Return to supplier credit adjustment for NCR ${ncr.code}`,
        "2000",
        "Accounts Payable",
        AccountType.LIABILITY,
        "1400",
        "Inventory",
        AccountType.ASSET,
        totalCost,
      );
    }
  }

  // --- CAPA CRUD ---
  async createCAPA(
    dto: CreateCAPADto,
    user: AuthUser,
  ): Promise<CorrectiveAction> {
    const tenantId = user.tenantId;
    if (!tenantId) throw new ForbiddenException("Tenant ID is required.");

    return this.transactionHelper.run(async (tx) => {
      const existing = await tx.correctiveAction.findFirst({
        where: { tenantId, code: dto.code, deletedAt: null },
      });
      if (existing) {
        throw new ConflictException(
          `CAPA with code ${dto.code} already exists.`,
        );
      }

      if (dto.ncrId) {
        const ncr = await tx.nonConformanceReport.findFirst({
          where: { id: dto.ncrId, tenantId, deletedAt: null },
        });
        if (!ncr) throw new NotFoundException("NCR not found.");
      }

      if (dto.assignedToId) {
        const u = await tx.user.findFirst({
          where: { id: dto.assignedToId, tenantId, deletedAt: null },
        });
        if (!u) throw new NotFoundException("Assigned user not found.");
      }

      const capa = await tx.correctiveAction.create({
        data: {
          tenantId,
          code: dto.code,
          ncrId: dto.ncrId,
          type: dto.type,
          description: dto.description,
          rootCause: dto.rootCause,
          assignedToId: dto.assignedToId,
          targetCompletionDate: new Date(dto.targetCompletionDate),
          status: "OPEN",
        },
      });

      if (dto.ncrId) {
        await tx.nonConformanceReport.update({
          where: { id: dto.ncrId },
          data: { status: "CAPA_PENDING" },
        });
      }

      await this.auditService.log(
        {
          action: "CAPA_CREATED",
          entity: "CorrectiveAction",
          entityId: capa.id,
          newValues: capa,
        },
        tx,
      );

      if (dto.assignedToId) {
        await this.notificationsService.createInternal(
          {
            userId: dto.assignedToId,
            tenantId,
            title: "New CAPA Task Assigned",
            message: `CAPA task ${capa.code} has been assigned to you. Due date: ${dto.targetCompletionDate}`,
            type: NotificationType.INFO,
          },
          tx,
        );
      }

      return capa;
    });
  }

  async updateCAPA(
    id: string,
    dto: UpdateCAPADto,
    user: AuthUser,
  ): Promise<CorrectiveAction> {
    const tenantId = user.tenantId;
    if (!tenantId) throw new ForbiddenException("Tenant ID is required.");

    return this.transactionHelper.run(async (tx) => {
      const capa = await tx.correctiveAction.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
      if (!capa) throw new NotFoundException("CAPA not found.");

      if (dto.assignedToId) {
        const u = await tx.user.findFirst({
          where: { id: dto.assignedToId, tenantId, deletedAt: null },
        });
        if (!u) throw new NotFoundException("Assigned user not found.");
      }

      const isClosing = dto.status === "CLOSED" || dto.status === "VERIFIED";

      const updated = await tx.correctiveAction.update({
        where: { id },
        data: {
          rootCause: dto.rootCause,
          status: dto.status,
          assignedToId: dto.assignedToId,
          targetCompletionDate: dto.targetCompletionDate
            ? new Date(dto.targetCompletionDate)
            : undefined,
          actualCompletionDate: isClosing ? new Date() : undefined,
          version: { increment: 1 },
        },
      });

      if (isClosing) {
        await this.auditService.log(
          {
            action: "CAPA_CLOSED",
            entity: "CorrectiveAction",
            entityId: capa.id,
            newValues: { status: updated.status },
          },
          tx,
        );

        if (updated.ncrId) {
          const otherCapas = await tx.correctiveAction.findMany({
            where: { ncrId: updated.ncrId, deletedAt: null },
          });
          const allResolved = otherCapas.every(
            (c) => c.status === "CLOSED" || c.status === "VERIFIED",
          );
          if (allResolved) {
            await tx.nonConformanceReport.update({
              where: { id: updated.ncrId },
              data: { status: "RESOLVED" },
            });
          }
        }
      }

      return updated;
    });
  }

  async findAllCAPAs(user: AuthUser): Promise<CorrectiveAction[]> {
    const tenantId = user.tenantId;
    if (!tenantId) throw new ForbiddenException("Tenant ID is required.");
    return this.prisma.correctiveAction.findMany({
      where: { tenantId, deletedAt: null },
      include: { ncr: true, assignedTo: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOneCAPA(id: string, user: AuthUser): Promise<CorrectiveAction> {
    const tenantId = user.tenantId;
    if (!tenantId) throw new ForbiddenException("Tenant ID is required.");
    const capa = await this.prisma.correctiveAction.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { ncr: true, assignedTo: true },
    });
    if (!capa) throw new NotFoundException("CAPA not found.");
    return capa;
  }

  // --- QUALITY CERTIFICATE (COA) CRUD ---
  async createCertificate(
    dto: CreateCertificateDto,
    user: AuthUser,
  ): Promise<QualityCertificate> {
    const tenantId = user.tenantId;
    if (!tenantId) throw new ForbiddenException("Tenant ID is required.");

    return this.transactionHelper.run(async (tx) => {
      const existing = await tx.qualityCertificate.findFirst({
        where: { tenantId, code: dto.code },
      });
      if (existing) {
        throw new ConflictException(
          `COA Certificate ${dto.code} already exists.`,
        );
      }

      const lot = await tx.inspectionLot.findFirst({
        where: { id: dto.inspectionLotId, tenantId, deletedAt: null },
      });
      if (!lot) throw new NotFoundException("Inspection lot not found.");

      const cert = await tx.qualityCertificate.create({
        data: {
          tenantId,
          code: dto.code,
          inspectionLotId: dto.inspectionLotId,
          certifiedBy: user.id,
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
          status: "DRAFT",
        },
      });

      return cert;
    });
  }

  async approveCertificate(
    id: string,
    user: AuthUser,
  ): Promise<QualityCertificate> {
    const tenantId = user.tenantId;
    if (!tenantId) throw new ForbiddenException("Tenant ID is required.");

    return this.transactionHelper.run(async (tx) => {
      const cert = await tx.qualityCertificate.findFirst({
        where: { id, tenantId },
      });
      if (!cert) throw new NotFoundException("COA Certificate not found.");

      const updated = await tx.qualityCertificate.update({
        where: { id },
        data: {
          status: "APPROVED",
          version: { increment: 1 },
        },
      });

      await this.auditService.log(
        {
          action: "QUALITY_CERTIFICATE_APPROVED",
          entity: "QualityCertificate",
          entityId: cert.id,
          newValues: { status: "APPROVED" },
        },
        tx,
      );

      return updated;
    });
  }

  async findAllCertificates(user: AuthUser): Promise<QualityCertificate[]> {
    const tenantId = user.tenantId;
    if (!tenantId) throw new ForbiddenException("Tenant ID is required.");
    return this.prisma.qualityCertificate.findMany({
      where: { tenantId },
      include: { lot: true, certifier: true },
      orderBy: { createdAt: "desc" },
    });
  }

  // --- SUPPLIER QUALITY RATINGS ---
  async findAllSupplierRatings(
    user: AuthUser,
  ): Promise<SupplierQualityRating[]> {
    const tenantId = user.tenantId;
    if (!tenantId) throw new ForbiddenException("Tenant ID is required.");
    return this.prisma.supplierQualityRating.findMany({
      where: { tenantId },
      orderBy: { score: "desc" },
    });
  }

  private async updateSupplierRating(
    tx: PrismaTx,
    tenantId: string,
    purchaseReceiptId: string,
    isPassed: boolean,
  ) {
    const receipt = await tx.purchaseReceipt.findUnique({
      where: { id: purchaseReceiptId },
      include: { purchaseOrder: true },
    });
    if (!receipt || !receipt.purchaseOrder) return;

    const supplierName = receipt.purchaseOrder.supplierName;

    const rating = await tx.supplierQualityRating.findFirst({
      where: { tenantId, supplierName },
    });

    const totalReceipts = (rating?.totalReceipts || 0) + 1;
    const rejectedReceipts =
      (rating?.rejectedReceipts || 0) + (isPassed ? 0 : 1);

    const score = Number(
      (((totalReceipts - rejectedReceipts) / totalReceipts) * 100).toFixed(2),
    );

    await tx.supplierQualityRating.upsert({
      where: {
        tenantId_supplierName: {
          tenantId,
          supplierName,
        },
      },
      update: {
        totalReceipts,
        rejectedReceipts,
        score,
        version: { increment: 1 },
      },
      create: {
        tenantId,
        supplierName,
        totalReceipts,
        rejectedReceipts,
        score,
      },
    });
  }

  // --- INTEGRATION INTERCEPTORS HANDLERS ---
  async handlePurchaseReceiptEvent(poId: string, user: AuthUser) {
    const tenantId = user.tenantId;
    if (!tenantId) return;

    await this.transactionHelper.run(async (tx) => {
      const receipt = await tx.purchaseReceipt.findFirst({
        where: { purchaseOrderId: poId, tenantId },
        include: { items: true },
        orderBy: { receivedAt: "desc" },
      });
      if (!receipt) return;

      for (const item of receipt.items) {
        const lotCode = `LOT-IN-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;
        await this.createInspectionLotInternal(
          tx,
          {
            tenantId,
            code: lotCode,
            productId: item.productId,
            type: "INCOMING",
            quantity: Number(item.quantityReceived),
            warehouseId: receipt.warehouseId,
            purchaseReceiptId: receipt.id,
          },
          user.id,
        );
      }
    });
  }

  async handleWorkOrderStartEvent(woId: string, user: AuthUser) {
    const tenantId = user.tenantId;
    if (!tenantId) return;

    await this.transactionHelper.run(async (tx) => {
      const wo = await tx.workOrder.findFirst({
        where: { id: woId, tenantId, deletedAt: null },
      });
      if (!wo) return;

      let warehouse = await tx.warehouse.findFirst({
        where: { tenantId, deletedAt: null },
      });
      if (!warehouse) {
        warehouse = await tx.warehouse.create({
          data: {
            tenantId,
            code: "MAIN",
            name: "Main Warehouse",
          },
        });
      }

      const lotCode = `LOT-IP-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;
      await this.createInspectionLotInternal(
        tx,
        {
          tenantId,
          code: lotCode,
          productId: wo.productId,
          type: "IN_PROCESS",
          quantity: Number(wo.quantity),
          warehouseId: warehouse.id,
          workOrderId: wo.id,
        },
        user.id,
      );
    });
  }

  async handleWorkOrderCompleteEvent(woId: string, user: AuthUser) {
    const tenantId = user.tenantId;
    if (!tenantId) return;

    await this.transactionHelper.run(async (tx) => {
      const wo = await tx.workOrder.findFirst({
        where: { id: woId, tenantId, deletedAt: null },
      });
      if (!wo) return;

      let warehouse = await tx.warehouse.findFirst({
        where: { tenantId, deletedAt: null },
      });
      if (!warehouse) {
        warehouse = await tx.warehouse.create({
          data: {
            tenantId,
            code: "MAIN",
            name: "Main Warehouse",
          },
        });
      }

      const lotCode = `LOT-FG-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;
      await this.createInspectionLotInternal(
        tx,
        {
          tenantId,
          code: lotCode,
          productId: wo.productId,
          type: "FINISHED_GOODS",
          quantity: Number(wo.quantity),
          warehouseId: warehouse.id,
          workOrderId: wo.id,
        },
        user.id,
      );
    });
  }

  // --- WAREHOUSE HELPERS ---
  private async getOrCreateHoldWarehouse(
    tx: PrismaTx,
    tenantId: string,
    mainWh: Warehouse,
  ): Promise<Warehouse> {
    const code = `HOLD-${mainWh.code || mainWh.id.substring(0, 8)}`;
    let wh = await tx.warehouse.findFirst({
      where: { tenantId, code, deletedAt: null },
    });
    if (!wh) {
      wh = await tx.warehouse.create({
        data: {
          tenantId,
          code,
          name: `${mainWh.name} (Hold)`,
          status: "ACTIVE",
        },
      });
    }
    return wh;
  }

  private async getOrCreateRejectedWarehouse(
    tx: PrismaTx,
    tenantId: string,
    mainWh: Warehouse,
  ): Promise<Warehouse> {
    const code = `REJ-${mainWh.code || mainWh.id.substring(0, 8)}`;
    let wh = await tx.warehouse.findFirst({
      where: { tenantId, code, deletedAt: null },
    });
    if (!wh) {
      wh = await tx.warehouse.create({
        data: {
          tenantId,
          code,
          name: `${mainWh.name} (Rejected)`,
          status: "ACTIVE",
        },
      });
    }
    return wh;
  }

  private async getOrCreateReworkWarehouse(
    tx: PrismaTx,
    tenantId: string,
    mainWh: Warehouse,
  ): Promise<Warehouse> {
    const code = `RWK-${mainWh.code || mainWh.id.substring(0, 8)}`;
    let wh = await tx.warehouse.findFirst({
      where: { tenantId, code, deletedAt: null },
    });
    if (!wh) {
      wh = await tx.warehouse.create({
        data: {
          tenantId,
          code,
          name: `${mainWh.name} (Rework)`,
          status: "ACTIVE",
        },
      });
    }
    return wh;
  }

  private async getOrCreateAccount(
    tx: PrismaTx,
    tenantId: string,
    code: string,
    name: string,
    type: AccountType,
  ) {
    let acc = await tx.account.findFirst({
      where: { tenantId, code, deletedAt: null },
    });
    if (!acc) {
      acc = await tx.account.create({
        data: {
          tenantId,
          code,
          name,
          type,
          status: "ACTIVE",
          description: `Seeded Quality account`,
        },
      });
    }
    return acc;
  }

  private async postQualityJournalEntry(
    tx: PrismaTx,
    tenantId: string,
    lotId: string,
    code: string,
    description: string,
    debitCode: string,
    debitName: string,
    debitType: AccountType,
    creditCode: string,
    creditName: string,
    creditType: AccountType,
    amount: number,
  ) {
    if (amount <= 0) return;

    const debitAccount = await this.getOrCreateAccount(
      tx,
      tenantId,
      debitCode,
      debitName,
      debitType,
    );
    const creditAccount = await this.getOrCreateAccount(
      tx,
      tenantId,
      creditCode,
      creditName,
      creditType,
    );

    const entryCode = `QLY-JE-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;

    const entry = await tx.journalEntry.create({
      data: {
        tenantId,
        entryNumber: entryCode,
        postingDate: new Date(),
        description,
        sourceType: JournalSourceType.STOCK_MOVEMENT,
        sourceId: lotId,
        status: "POSTED",
        lines: {
          create: [
            {
              tenantId,
              accountId: debitAccount.id,
              debit: amount,
              credit: 0,
              description: `Debit: ${debitName}`,
            },
            {
              tenantId,
              accountId: creditAccount.id,
              debit: 0,
              credit: amount,
              description: `Credit: ${creditName}`,
            },
          ],
        },
      },
    });

    return entry;
  }
}
