/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { PrismaService } from "@amdox/database";
import { AuditService } from "../../../common/audit/audit.service";
import { NotificationsService } from "../../notifications/notifications.service";
import {
  TicketStatus,
  TicketPriority,
  RmaStatus,
  ServiceVisitStatus,
  JournalSourceType,
} from "@amdox/database/generated";
import { CreateCategoryDto, UpdateCategoryDto } from "../dto/category.dto";
import { CreateSlaPolicyDto, UpdateSlaPolicyDto } from "../dto/sla-policy.dto";
import { CreateContractDto, UpdateContractDto } from "../dto/contract.dto";
import {
  CreateTicketDto,
  UpdateTicketDto,
  AddTicketNoteDto,
  SubmitCsatDto,
  MergeTicketsDto,
  SplitTicketDto,
} from "../dto/ticket.dto";
import { CreateRmaDto, UpdateRmaStatusDto } from "../dto/rma.dto";
import {
  CreateServiceVisitDto,
  UpdateServiceVisitStatusDto,
} from "../dto/visit.dto";
import { CreateKbArticleDto, UpdateKbArticleDto } from "../dto/kb.dto";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";
import PDFDocument from "pdfkit";
import { Readable } from "stream";

@Injectable()
export class CsmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly moduleRef: ModuleRef,
  ) {}

  // --- TICKET CATEGORIES ---
  async createCategory(dto: CreateCategoryDto, user: AuthUser) {
    const category = await this.prisma.ticketCategory.create({
      data: {
        tenantId: user.tenantId!,
        ...dto,
      },
    });

    await this.auditService.log({
      action: "CATEGORY_CREATED",
      entity: "TicketCategory",
      entityId: category.id,
      newValues: category as any,
      userId: user.id,
      tenantId: user.tenantId,
    });

    return category;
  }

  async updateCategory(id: string, dto: UpdateCategoryDto, user: AuthUser) {
    const category = await this.prisma.ticketCategory.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!category) throw new NotFoundException("Category not found");

    const updated = await this.prisma.ticketCategory.update({
      where: { id },
      data: dto,
    });

    await this.auditService.log({
      action: "CATEGORY_UPDATED",
      entity: "TicketCategory",
      entityId: category.id,
      oldValues: category as any,
      newValues: updated as any,
      userId: user.id,
      tenantId: user.tenantId,
    });

    return updated;
  }

  async deleteCategory(id: string, user: AuthUser) {
    const category = await this.prisma.ticketCategory.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!category) throw new NotFoundException("Category not found");

    await this.prisma.ticketCategory.delete({ where: { id } });

    await this.auditService.log({
      action: "CATEGORY_DELETED",
      entity: "TicketCategory",
      entityId: category.id,
      oldValues: category as any,
      userId: user.id,
      tenantId: user.tenantId,
    });

    return { success: true };
  }

  async listCategories(user: AuthUser) {
    return this.prisma.ticketCategory.findMany({
      where: { tenantId: user.tenantId },
    });
  }

  // --- SLA POLICIES ---
  async createSlaPolicy(dto: CreateSlaPolicyDto, user: AuthUser) {
    const policy = await this.prisma.slaPolicy.create({
      data: {
        tenantId: user.tenantId!,
        ...dto,
      },
    });

    await this.auditService.log({
      action: "SLA_POLICY_CREATED",
      entity: "SlaPolicy",
      entityId: policy.id,
      newValues: policy as any,
      userId: user.id,
      tenantId: user.tenantId,
    });

    return policy;
  }

  async updateSlaPolicy(id: string, dto: UpdateSlaPolicyDto, user: AuthUser) {
    const policy = await this.prisma.slaPolicy.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!policy) throw new NotFoundException("SLA Policy not found");

    const updated = await this.prisma.slaPolicy.update({
      where: { id },
      data: dto,
    });

    await this.auditService.log({
      action: "SLA_POLICY_UPDATED",
      entity: "SlaPolicy",
      entityId: policy.id,
      oldValues: policy as any,
      newValues: updated as any,
      userId: user.id,
      tenantId: user.tenantId,
    });

    return updated;
  }

  async deleteSlaPolicy(id: string, user: AuthUser) {
    const policy = await this.prisma.slaPolicy.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!policy) throw new NotFoundException("SLA Policy not found");

    await this.prisma.slaPolicy.delete({ where: { id } });

    await this.auditService.log({
      action: "SLA_POLICY_DELETED",
      entity: "SlaPolicy",
      entityId: policy.id,
      oldValues: policy as any,
      userId: user.id,
      tenantId: user.tenantId,
    });

    return { success: true };
  }

  async listSlaPolicies(user: AuthUser) {
    return this.prisma.slaPolicy.findMany({
      where: { tenantId: user.tenantId },
    });
  }

  // --- SERVICE CONTRACTS ---
  async createContract(dto: CreateContractDto, user: AuthUser) {
    const contract = await this.prisma.serviceContract.create({
      data: {
        tenantId: user.tenantId!,
        customerId: dto.customerId,
        productId: dto.productId,
        contractNumber: dto.contractNumber,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        warrantyPeriod: dto.warrantyPeriod,
        status: dto.status,
      },
    });

    await this.auditService.log({
      action: "SERVICE_CONTRACT_CREATED",
      entity: "ServiceContract",
      entityId: contract.id,
      newValues: contract as any,
      userId: user.id,
      tenantId: user.tenantId,
    });

    return contract;
  }

  async updateContract(id: string, dto: UpdateContractDto, user: AuthUser) {
    const contract = await this.prisma.serviceContract.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!contract) throw new NotFoundException("Contract not found");

    const updated = await this.prisma.serviceContract.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });

    await this.auditService.log({
      action: "SERVICE_CONTRACT_UPDATED",
      entity: "ServiceContract",
      entityId: contract.id,
      oldValues: contract as any,
      newValues: updated as any,
      userId: user.id,
      tenantId: user.tenantId,
    });

    return updated;
  }

  async listContracts(user: AuthUser) {
    return this.prisma.serviceContract.findMany({
      where: { tenantId: user.tenantId },
      include: { customer: true, product: true },
    });
  }

  // --- SUPPORT TICKETS ---
  async createTicket(dto: CreateTicketDto, user: AuthUser) {
    const nextTicketNumber = `TCK-${Date.now().toString().substring(6)}`;

    // Match SLA Policy
    const slaPolicy = await this.prisma.slaPolicy.findFirst({
      where: {
        tenantId: user.tenantId,
        priority: dto.priority || TicketPriority.MEDIUM,
      },
    });

    const slaDueAt = slaPolicy
      ? new Date(Date.now() + slaPolicy.resolutionTimeLimitMin * 60000)
      : null;

    const ticket = await this.prisma.supportTicket.create({
      data: {
        tenantId: user.tenantId!,
        ticketNumber: nextTicketNumber,
        title: dto.title,
        description: dto.description,
        priority: dto.priority || TicketPriority.MEDIUM,
        categoryId: dto.categoryId,
        customerId: dto.customerId,
        productId: dto.productId || null,
        contractId: dto.contractId || null,
        slaDueAt,
      },
    });

    await this.auditService.log({
      action: "TICKET_CREATED",
      entity: "SupportTicket",
      entityId: ticket.id,
      newValues: ticket as any,
      userId: user.id,
      tenantId: user.tenantId,
    });

    return ticket;
  }

  async updateTicket(id: string, dto: UpdateTicketDto, user: AuthUser) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!ticket) throw new NotFoundException("Ticket not found");

    if (ticket.version !== dto.expectedVersion) {
      throw new ConflictException("DATABASE.CONFLICT");
    }

    const nextStatus = dto.status || ticket.status;
    const isAssigning =
      dto.assignedAgentId && dto.assignedAgentId !== ticket.assignedAgentId;
    const isResolving =
      nextStatus === TicketStatus.RESOLVED &&
      ticket.status !== TicketStatus.RESOLVED;

    const updated = await this.prisma.supportTicket.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        status: nextStatus,
        priority: dto.priority,
        categoryId: dto.categoryId,
        assignedAgentId: dto.assignedAgentId,
        resolvedAt: isResolving ? new Date() : undefined,
        version: ticket.version + 1,
      },
    });

    if (isAssigning) {
      await this.auditService.log({
        action: "TICKET_ASSIGNED",
        entity: "SupportTicket",
        entityId: ticket.id,
        newValues: { assignedAgentId: dto.assignedAgentId },
        userId: user.id,
        tenantId: user.tenantId,
      });

      await this.notificationsService.createInternal({
        userId: dto.assignedAgentId!,
        tenantId: user.tenantId,
        title: "Support Ticket Assigned",
        message: `Ticket ${ticket.ticketNumber} has been assigned to you.`,
        type: "INFO" as any,
      });
    }

    if (isResolving) {
      await this.auditService.log({
        action: "TICKET_RESOLVED",
        entity: "SupportTicket",
        entityId: ticket.id,
        newValues: { status: TicketStatus.RESOLVED },
        userId: user.id,
        tenantId: user.tenantId,
      });
    }

    await this.auditService.log({
      action: "TICKET_UPDATED",
      entity: "SupportTicket",
      entityId: ticket.id,
      oldValues: ticket as any,
      newValues: updated as any,
      userId: user.id,
      tenantId: user.tenantId,
    });

    return updated;
  }

  async getTicket(id: string, user: AuthUser) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        category: true,
        customer: true,
        product: true,
        contract: true,
        notes: {
          orderBy: { createdAt: "asc" },
          include: { author: true },
        },
      },
    });
    if (!ticket) throw new NotFoundException("Ticket not found");
    return ticket;
  }

  async listTickets(user: AuthUser, query?: any) {
    const where: any = { tenantId: user.tenantId };
    if (query?.status) where.status = query.status;
    if (query?.priority) where.priority = query.priority;

    return this.prisma.supportTicket.findMany({
      where,
      include: { category: true, customer: true, assignedAgent: true },
      orderBy: { createdAt: "desc" },
    });
  }

  // --- TICKET NOTES & INTERACTIONS ---
  async addTicketNote(ticketId: string, dto: AddTicketNoteDto, user: AuthUser) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, tenantId: user.tenantId },
    });
    if (!ticket) throw new NotFoundException("Ticket not found");

    const note = await this.prisma.ticketNote.create({
      data: {
        tenantId: user.tenantId!,
        ticketId,
        authorId: user.id,
        content: dto.content,
        isInternal: dto.isInternal || false,
        attachments: dto.attachments || [],
      },
    });

    // Update ticket state if status was PENDING_CUSTOMER and customer responds
    const isCustomer =
      user.roles?.length === 0 ||
      (!user.roles?.includes("Admin") && !user.roles?.includes("Agent"));
    if (isCustomer && ticket.status === TicketStatus.PENDING_CUSTOMER) {
      await this.prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: TicketStatus.IN_PROGRESS },
      });
    }

    await this.auditService.log({
      action: "TICKET_NOTE_ADDED",
      entity: "TicketNote",
      entityId: note.id,
      newValues: note as any,
      userId: user.id,
      tenantId: user.tenantId,
    });

    return note;
  }

  // --- CSAT & SURVEY FEEDBACK ---
  async submitCsat(ticketId: string, dto: SubmitCsatDto, user: AuthUser) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, tenantId: user.tenantId },
    });
    if (!ticket) throw new NotFoundException("Ticket not found");

    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        csatRating: dto.rating,
        csatComment: dto.comment,
      },
    });

    await this.auditService.log({
      action: "CSAT_RECEIVED",
      entity: "SupportTicket",
      entityId: ticket.id,
      newValues: { csatRating: dto.rating, csatComment: dto.comment },
      userId: user.id,
      tenantId: user.tenantId,
    });

    // Notify agent if assigned
    if (ticket.assignedAgentId) {
      await this.notificationsService.createInternal({
        userId: ticket.assignedAgentId,
        tenantId: user.tenantId,
        title: "Customer CSAT Feedback Received",
        message: `CSAT Rating of ${dto.rating}/5 stars was submitted for Ticket ${ticket.ticketNumber}.`,
        type: "SUCCESS" as any,
      });
    }

    return updated;
  }

  // --- TICKET MERGE & SPLIT ---
  async mergeTickets(dto: MergeTicketsDto, user: AuthUser) {
    const primary = await this.prisma.supportTicket.findFirst({
      where: { id: dto.primaryTicketId, tenantId: user.tenantId },
    });
    const secondary = await this.prisma.supportTicket.findFirst({
      where: { id: dto.secondaryTicketId, tenantId: user.tenantId },
    });

    if (!primary || !secondary)
      throw new NotFoundException("One or both tickets not found");

    // Close secondary ticket and record hierarchy link
    await this.prisma.supportTicket.update({
      where: { id: dto.secondaryTicketId },
      data: {
        status: TicketStatus.CLOSED,
        parentTicketId: dto.primaryTicketId,
      },
    });

    // Copy notes from secondary to primary
    const secondaryNotes = await this.prisma.ticketNote.findMany({
      where: { ticketId: dto.secondaryTicketId },
    });

    for (const note of secondaryNotes) {
      await this.prisma.ticketNote.create({
        data: {
          tenantId: user.tenantId!,
          ticketId: dto.primaryTicketId,
          authorId: note.authorId,
          content: `[Merged Note from ${secondary.ticketNumber}]: ${note.content}`,
          isInternal: note.isInternal,
          attachments: note.attachments,
        },
      });
    }

    await this.auditService.log({
      action: "TICKET_MERGED",
      entity: "SupportTicket",
      entityId: primary.id,
      newValues: { mergedTicketId: secondary.id },
      userId: user.id,
      tenantId: user.tenantId,
    });

    return { success: true };
  }

  async splitTicket(ticketId: string, dto: SplitTicketDto, user: AuthUser) {
    const parent = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, tenantId: user.tenantId },
    });
    if (!parent) throw new NotFoundException("Parent ticket not found");

    const childTicketNumber = `TCK-${Date.now().toString().substring(6)}`;
    const child = await this.prisma.supportTicket.create({
      data: {
        tenantId: user.tenantId!,
        ticketNumber: childTicketNumber,
        title: dto.newTitle,
        description: dto.newDescription,
        priority: parent.priority,
        categoryId: parent.categoryId,
        customerId: parent.customerId,
        parentTicketId: parent.id,
      },
    });

    // Move specified notes if requested
    if (dto.noteIdsToMove && dto.noteIdsToMove.length > 0) {
      await this.prisma.ticketNote.updateMany({
        where: { id: { in: dto.noteIdsToMove }, ticketId: parent.id },
        data: { ticketId: child.id },
      });
    }

    await this.auditService.log({
      action: "TICKET_SPLIT",
      entity: "SupportTicket",
      entityId: parent.id,
      newValues: { childTicketId: child.id },
      userId: user.id,
      tenantId: user.tenantId,
    });

    return child;
  }

  // --- KNOWLEDGE BASE ---
  async createKbArticle(dto: CreateKbArticleDto, user: AuthUser) {
    const article = await this.prisma.kbArticle.create({
      data: {
        tenantId: user.tenantId!,
        ...dto,
      },
    });

    await this.auditService.log({
      action: "KB_ARTICLE_CREATED",
      entity: "KbArticle",
      entityId: article.id,
      newValues: article as any,
      userId: user.id,
      tenantId: user.tenantId,
    });

    return article;
  }

  async updateKbArticle(id: string, dto: UpdateKbArticleDto, user: AuthUser) {
    const article = await this.prisma.kbArticle.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!article) throw new NotFoundException("KB Article not found");

    const updated = await this.prisma.kbArticle.update({
      where: { id },
      data: dto,
    });

    await this.auditService.log({
      action: "KB_ARTICLE_UPDATED",
      entity: "KbArticle",
      entityId: article.id,
      oldValues: article as any,
      newValues: updated as any,
      userId: user.id,
      tenantId: user.tenantId,
    });

    return updated;
  }

  async listKbArticles(user: AuthUser, category?: string) {
    const where: any = { tenantId: user.tenantId };
    if (category) where.category = category;
    return this.prisma.kbArticle.findMany({ where });
  }

  // --- EMAIL-TO-TICKET INGESTION PIPELINE ---
  async ingestEmailTicket(
    dto: { from: string; subject: string; body: string },
    user: AuthUser,
  ) {
    // Lookup customer by email
    let customer = await this.prisma.customer.findFirst({
      where: { tenantId: user.tenantId, email: dto.from },
    });

    if (!customer) {
      // Find fallback or create a new customer
      customer = await this.prisma.customer.findFirst({
        where: { tenantId: user.tenantId! },
      });
      if (!customer) {
        customer = await this.prisma.customer.create({
          data: {
            tenantId: user.tenantId!,
            name: `Walk-in Customer ${dto.from.split("@")[0]}`,
            email: dto.from,
          },
        });
      }
    }

    // Lookup first category
    let category = await this.prisma.ticketCategory.findFirst({
      where: { tenantId: user.tenantId! },
    });
    if (!category) {
      category = await this.prisma.ticketCategory.create({
        data: {
          tenantId: user.tenantId!,
          name: "Default Inquiries",
          description: "Ingested via email pipeline",
        },
      });
    }

    const ticketNumber = `TCK-${Date.now().toString().substring(6)}`;
    const ticket = await this.prisma.supportTicket.create({
      data: {
        tenantId: user.tenantId!,
        ticketNumber,
        title: dto.subject,
        description: dto.body,
        categoryId: category.id,
        customerId: customer.id,
        priority: TicketPriority.MEDIUM,
      },
    });

    await this.auditService.log({
      action: "TICKET_CREATED",
      entity: "SupportTicket",
      entityId: ticket.id,
      newValues: { ...ticket, source: "EMAIL_INGEST" } as any,
      userId: user.id,
      tenantId: user.tenantId,
    });

    return ticket;
  }

  // --- RMA PROCESSES & QUALITY / WMS / WORKFLOW / ACCOUNTING INTEGRATIONS ---
  async createRma(dto: CreateRmaDto, user: AuthUser) {
    const nextRmaNumber = `RMA-${Date.now().toString().substring(6)}`;

    // Verify WMS Bin for Return Putaway if specified, or load default WMS Warehouse suggestions
    let warehouseBinId = null;
    const { WmsService } = await import("../../wms/services/wms.service.js");
    const wmsService = this.moduleRef.get(WmsService, { strict: false });
    if (
      wmsService &&
      typeof (wmsService as any).suggestPutawayBin === "function"
    ) {
      try {
        const binSuggestion = await (wmsService as any).suggestPutawayBin(
          user.tenantId!,
          dto.productId,
        );
        if (binSuggestion) {
          warehouseBinId = binSuggestion.id;
        }
      } catch (err) {
        // Fallback handled below
      }
    }

    if (!warehouseBinId) {
      const dbBin = await this.prisma.warehouseBin.findFirst({
        where: { tenantId: user.tenantId! },
      });
      if (dbBin) warehouseBinId = dbBin.id;
    }

    // Fetch warehouseId for fallback inspection lot creation
    let fallbackWarehouseId = "";
    const dbBinForLot = await this.prisma.warehouseBin.findFirst({
      where: { tenantId: user.tenantId!, id: warehouseBinId || undefined },
      include: { zone: true },
    });
    if (dbBinForLot) {
      fallbackWarehouseId = dbBinForLot.zone.warehouseId;
    } else {
      const firstWh = await this.prisma.warehouse.findFirst({
        where: { tenantId: user.tenantId! },
      });
      if (firstWh) fallbackWarehouseId = firstWh.id;
    }

    // Automatically trigger inspection lot in Quality module for RMA
    let inspectionLotId = null;
    const { QualityService } =
      await import("../../quality/services/quality.service.js");
    const qualityService = this.moduleRef.get(QualityService, {
      strict: false,
    });
    if (
      qualityService &&
      typeof (qualityService as any).createInspectionLot === "function"
    ) {
      try {
        const lotCode = `LOT-RMA-${nextRmaNumber.substring(4)}`;
        const lot = await (qualityService as any).createInspectionLot(
          {
            productId: dto.productId,
            quantity: dto.quantity,
            type: "INCOMING",
            code: lotCode,
          },
          user,
        );
        if (lot) {
          inspectionLotId = lot.id;
        }
      } catch (err) {
        // Direct prisma insert fallback
        const lot = await this.prisma.inspectionLot.create({
          data: {
            tenantId: user.tenantId!,
            code: `LOT-RMA-${nextRmaNumber.substring(4)}`,
            productId: dto.productId,
            quantity: dto.quantity,
            type: "INCOMING",
            status: "PENDING",
            warehouseId: fallbackWarehouseId,
            sampleSize: 1,
          },
        });
        inspectionLotId = lot.id;
      }
    } else {
      const lot = await this.prisma.inspectionLot.create({
        data: {
          tenantId: user.tenantId!,
          code: `LOT-RMA-${nextRmaNumber.substring(4)}`,
          productId: dto.productId,
          quantity: dto.quantity,
          type: "INCOMING",
          status: "PENDING",
          warehouseId: fallbackWarehouseId,
          sampleSize: 1,
        },
      });
      inspectionLotId = lot.id;
    }

    const rma = await this.prisma.rmaRequest.create({
      data: {
        tenantId: user.tenantId!,
        rmaNumber: nextRmaNumber,
        ticketId: dto.ticketId || null,
        customerId: dto.customerId,
        productId: dto.productId,
        contractId: dto.contractId || null,
        quantity: dto.quantity,
        reason: dto.reason,
        actionType: dto.actionType,
        refundAmount: dto.refundAmount || 0,
        status: RmaStatus.SUBMITTED,
        inspectionLotId,
        warehouseBinId,
      },
    });

    await this.auditService.log({
      action: "RMA_CREATED",
      entity: "RmaRequest",
      entityId: rma.id,
      newValues: rma as any,
      userId: user.id,
      tenantId: user.tenantId,
    });

    // Check if Workflow approval is needed (refundAmount > 5000)
    if (dto.actionType === "REFUND" && (dto.refundAmount || 0) > 5000) {
      const { WorkflowService } =
        await import("../../workflow/services/workflow.service.js");
      const workflowService = this.moduleRef.get(WorkflowService, {
        strict: false,
      });
      if (
        workflowService &&
        typeof (workflowService as any).submitInstance === "function"
      ) {
        await (workflowService as any).submitInstance(
          {
            definitionCode: "RMA_REFUND_WF",
            entityType: "RmaRequest",
            entityId: rma.id,
            title: `RMA Refund Approval: ${rma.rmaNumber} (Amount: $${dto.refundAmount})`,
            description: `RMA request refund exceeds $5,000 threshold. Manual review required.`,
          },
          user,
        );
      }
    }

    return rma;
  }

  async updateRmaStatus(id: string, dto: UpdateRmaStatusDto, user: AuthUser) {
    const rma = await this.prisma.rmaRequest.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!rma) throw new NotFoundException("RMA request not found");

    if (rma.version !== dto.expectedVersion) {
      throw new ConflictException("DATABASE.CONFLICT");
    }

    const nextStatus = dto.status;
    const isApproving =
      nextStatus === RmaStatus.APPROVED && rma.status !== RmaStatus.APPROVED;

    // Strict Workflow guard: Check if refund exceeding 5000 has been approved
    if (
      isApproving &&
      rma.actionType === "REFUND" &&
      (rma.refundAmount || 0) > 5000
    ) {
      const { WorkflowService } =
        await import("../../workflow/services/workflow.service.js");
      const workflowService = this.moduleRef.get(WorkflowService, {
        strict: false,
      });
      if (
        workflowService &&
        typeof (workflowService as any).searchInstances === "function"
      ) {
        const wfSearch = await (workflowService as any).searchInstances(
          {
            entityType: "RmaRequest",
            entityId: rma.id,
          },
          user,
        );

        const activeWf = wfSearch?.find((w: any) => w.status !== "APPROVED");
        if (activeWf) {
          throw new ConflictException(
            "RMA refund approval is pending in the Workflow Engine.",
          );
        }
      }
    }

    const updated = await this.prisma.rmaRequest.update({
      where: { id },
      data: {
        status: nextStatus,
        warehouseBinId: dto.warehouseBinId || rma.warehouseBinId,
        version: rma.version + 1,
      },
    });

    if (isApproving) {
      await this.auditService.log({
        action: "RMA_APPROVED",
        entity: "RmaRequest",
        entityId: rma.id,
        newValues: { status: RmaStatus.APPROVED },
        userId: user.id,
        tenantId: user.tenantId,
      });

      if (rma.actionType === "REFUND") {
        const { AccountingService } =
          await import("../../accounting/accounting.service.js");
        const accountingService = this.moduleRef.get(AccountingService, {
          strict: false,
        });
        if (
          accountingService &&
          typeof (accountingService as any).automatedPost === "function"
        ) {
          try {
            // Debit 4100 (Sales Returns/Refunds), Credit 2010 (Accounts Payable)
            await (accountingService as any).automatedPost(
              this.prisma,
              JournalSourceType.MANUAL,
              rma.id,
              `RMA refund approval journal for RMA ${rma.rmaNumber}`,
              [
                { code: "4100", debit: rma.refundAmount || 0, credit: 0 },
                { code: "2010", debit: 0, credit: rma.refundAmount || 0 },
              ],
              user,
            );

            // Re-stocking adjustment if product is returned: Debit 1400 (Inventory Asset), Credit 5100 (COGS)
            const product = await this.prisma.product.findFirst({
              where: { id: rma.productId },
            });
            if (product) {
              const costAmount = Number(product.costPrice) * rma.quantity;
              await (accountingService as any).automatedPost(
                this.prisma,
                JournalSourceType.STOCK_MOVEMENT,
                rma.id,
                `RMA return inventory restocking journal for RMA ${rma.rmaNumber}`,
                [
                  { code: "1400", debit: costAmount, credit: 0 },
                  { code: "5100", debit: 0, credit: costAmount },
                ],
                user,
              );
            }
          } catch (err) {
            console.error("CSM Accounting post failed:", err);
          }
        }
      }

      // Notify customer/agent
      await this.notificationsService.createInternal({
        userId: user.id, // Notification sent to the requester agent
        tenantId: user.tenantId,
        title: "RMA Request Approved",
        message: `RMA request ${rma.rmaNumber} has been approved.`,
        type: "SUCCESS" as any,
      });
    }

    await this.auditService.log({
      action: "RMA_UPDATED",
      entity: "RmaRequest",
      entityId: rma.id,
      oldValues: rma as any,
      newValues: updated as any,
      userId: user.id,
      tenantId: user.tenantId,
    });

    return updated;
  }

  // --- FIELD SERVICE VISITS & TECHNICIAN ASSIGNMENTS ---
  async createServiceVisit(dto: CreateServiceVisitDto, user: AuthUser) {
    const nextVisitNumber = `FSV-${Date.now().toString().substring(6)}`;

    // Verify Vehicle availability inside TMS if specified
    if (dto.vehicleId) {
      const { TmsService } = await import("../../tms/services/tms.service.js");
      const tmsService = this.moduleRef.get(TmsService, { strict: false });
      if (
        tmsService &&
        typeof (tmsService as any).findActiveVehicles === "function"
      ) {
        const vehicles = await (tmsService as any).findActiveVehicles(user);
        const exists = vehicles?.find((v: any) => v.id === dto.vehicleId);
        if (!exists) {
          throw new ConflictException(
            "Assigned vehicle is not active or available.",
          );
        }
      }
    }

    const visit = await this.prisma.serviceVisit.create({
      data: {
        tenantId: user.tenantId!,
        visitNumber: nextVisitNumber,
        ticketId: dto.ticketId,
        technicianId: dto.technicianId,
        vehicleId: dto.vehicleId || null,
        driverId: dto.driverId || null,
        scheduledAt: new Date(dto.scheduledAt),
      },
    });

    await this.auditService.log({
      action: "SERVICE_VISIT_SCHEDULED",
      entity: "ServiceVisit",
      entityId: visit.id,
      newValues: visit as any,
      userId: user.id,
      tenantId: user.tenantId,
    });

    // Notify technician
    await this.notificationsService.createInternal({
      userId: dto.technicianId,
      tenantId: user.tenantId,
      title: "Field Service Scheduled",
      message: `You have been assigned to Field Service Visit ${visit.visitNumber} on ${dto.scheduledAt}.`,
      type: "INFO" as any,
    });

    return visit;
  }

  async updateServiceVisit(
    id: string,
    dto: UpdateServiceVisitStatusDto,
    user: AuthUser,
  ) {
    const visit = await this.prisma.serviceVisit.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!visit) throw new NotFoundException("Service visit not found");

    const isCompleting =
      dto.status === ServiceVisitStatus.COMPLETED &&
      visit.status !== ServiceVisitStatus.COMPLETED;

    const updated = await this.prisma.serviceVisit.update({
      where: { id },
      data: {
        status: dto.status,
        resolutionNotes: dto.resolutionNotes,
        latitude: dto.latitude || visit.latitude,
        longitude: dto.longitude || visit.longitude,
        completedAt: isCompleting ? new Date() : undefined,
      },
    });

    if (isCompleting) {
      await this.auditService.log({
        action: "SERVICE_VISIT_COMPLETED",
        entity: "ServiceVisit",
        entityId: visit.id,
        newValues: { status: ServiceVisitStatus.COMPLETED },
        userId: user.id,
        tenantId: user.tenantId,
      });

      // Update parent ticket status to RESOLVED
      await this.prisma.supportTicket.update({
        where: { id: visit.ticketId },
        data: { status: TicketStatus.RESOLVED, resolvedAt: new Date() },
      });
    }

    return updated;
  }

  // --- DASHBOARD AGGREGATED METRICS ---
  async getDashboardSummary(user: AuthUser) {
    const openTickets = await this.prisma.supportTicket.count({
      where: { tenantId: user.tenantId, status: { not: TicketStatus.CLOSED } },
    });

    const slaBreached = await this.prisma.supportTicket.count({
      where: { tenantId: user.tenantId, slaBreached: true },
    });

    const totalResolved = await this.prisma.supportTicket.findMany({
      where: {
        tenantId: user.tenantId,
        status: TicketStatus.RESOLVED,
        resolvedAt: { not: null },
      },
      select: { createdAt: true, resolvedAt: true },
    });

    let avgResolutionTimeHours = 0;
    if (totalResolved.length > 0) {
      const sumTimes = totalResolved.reduce((acc, curr) => {
        const durationMs =
          curr.resolvedAt!.getTime() - curr.createdAt.getTime();
        return acc + durationMs;
      }, 0);
      avgResolutionTimeHours = Math.round(
        sumTimes / totalResolved.length / 3600000,
      );
    }

    const rmas = await this.prisma.rmaRequest.count({
      where: { tenantId: user.tenantId },
    });

    const serviceVisits = await this.prisma.serviceVisit.count({
      where: { tenantId: user.tenantId },
    });

    const csatSum = await this.prisma.supportTicket.aggregate({
      where: { tenantId: user.tenantId, csatRating: { not: null } },
      _avg: { csatRating: true },
    });

    return {
      openTickets,
      slaBreaches: slaBreached,
      averageResolutionTime: avgResolutionTimeHours,
      csat: csatSum._avg.csatRating || 0,
      rmas,
      serviceVisits,
    };
  }

  // --- REPORT EXPORT SERVICES (CSV & PDF GENERATION) ---
  async exportCsvReport(user: AuthUser): Promise<string> {
    const tickets = await this.prisma.supportTicket.findMany({
      where: { tenantId: user.tenantId },
      include: { customer: true, category: true },
    });

    let csvContent =
      "Ticket Number,Title,Status,Priority,Category,Customer,Created At,SLA Breached,CSAT\n";
    for (const t of tickets) {
      csvContent += `"${t.ticketNumber}","${t.title.replace(/"/g, '""')}","${t.status}","${t.priority}","${t.category.name}","${t.customer.name}","${t.createdAt.toISOString()}",${t.slaBreached},${t.csatRating || ""}\n`;
    }

    return csvContent;
  }

  async exportPdfReport(user: AuthUser): Promise<Readable> {
    const summary = await this.getDashboardSummary(user);
    const doc = new PDFDocument();

    doc
      .fontSize(18)
      .text("Enterprise Customer Service (CSM) Performance Report", {
        align: "center",
      });
    doc.moveDown();
    doc.fontSize(12).text(`Report Date: ${new Date().toLocaleDateString()}`);
    doc.text(`Tenant ID: ${user.tenantId}`);
    doc.moveDown();

    doc.text(`Total Open Tickets: ${summary.openTickets}`);
    doc.text(`SLA Breached Tickets: ${summary.slaBreaches}`);
    doc.text(
      `Average Resolution Time (Hours): ${summary.averageResolutionTime}`,
    );
    doc.text(
      `Customer Satisfaction (CSAT): ${summary.csat ? summary.csat.toFixed(1) : "N/A"}/5.0`,
    );
    doc.text(`Total RMA Requests: ${summary.rmas}`);
    doc.text(`Total Field Service Visits: ${summary.serviceVisits}`);
    doc.moveDown();

    doc.end();
    return doc;
  }

  async onWorkflowComplete(
    tx: any,
    tenantId: string,
    entityId: string,
    status: any,
    user: any,
  ) {
    if (status === "APPROVED") {
      const rma = await tx.rmaRequest.findUnique({
        where: { id: entityId, tenantId },
      });
      if (!rma) return;

      await tx.rmaRequest.update({
        where: { id: entityId, tenantId },
        data: {
          status: RmaStatus.APPROVED,
          version: rma.version + 1,
        },
      });

      if (rma.actionType === "REFUND") {
        const { AccountingService } =
          await import("../../accounting/accounting.service.js");
        const accountingService = this.moduleRef.get(AccountingService, {
          strict: false,
        });
        if (
          accountingService &&
          typeof (accountingService as any).automatedPost === "function"
        ) {
          try {
            await (accountingService as any).automatedPost(
              tx,
              JournalSourceType.MANUAL,
              rma.id,
              `RMA refund approval journal for RMA ${rma.rmaNumber}`,
              [
                { code: "4100", debit: rma.refundAmount || 0, credit: 0 },
                { code: "2010", debit: 0, credit: rma.refundAmount || 0 },
              ],
              user,
            );

            const product = await tx.product.findFirst({
              where: { id: rma.productId },
            });
            if (product) {
              const costAmount = Number(product.costPrice) * rma.quantity;
              await (accountingService as any).automatedPost(
                tx,
                JournalSourceType.STOCK_MOVEMENT,
                rma.id,
                `RMA return inventory restocking journal for RMA ${rma.rmaNumber}`,
                [
                  { code: "1400", debit: costAmount, credit: 0 },
                  { code: "5100", debit: 0, credit: costAmount },
                ],
                user,
              );
            }
          } catch (err) {
            console.error("CSM Workflow Callback Accounting post failed:", err);
          }
        }
      }

      await this.notificationsService.createInternal({
        userId: user.id,
        tenantId: user.tenantId,
        title: "RMA Request Approved",
        message: `RMA request ${rma.rmaNumber} has been approved.`,
        type: "SUCCESS" as any,
      });
    } else if (status === "REJECTED") {
      await tx.rmaRequest.update({
        where: { id: entityId, tenantId },
        data: {
          status: RmaStatus.REJECTED,
        },
      });
    }
  }
}