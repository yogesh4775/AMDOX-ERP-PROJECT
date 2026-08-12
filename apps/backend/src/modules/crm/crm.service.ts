import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { AuditService } from "../../common/audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import {
  TransactionHelper,
  PrismaTx,
} from "../../common/transactions/transaction.helper";
import { NotificationType } from "../notifications/dto/query-notification.dto";
import {
  Prisma,
  LeadStatus,
  LeadSource,
  OpportunityStage,
  CRMActivityType,
  MasterStatus,
} from "@amdox/database/generated";
import { CreateLeadDto } from "./dto/create-lead.dto";
import { UpdateLeadDto } from "./dto/update-lead.dto";
import { CreateContactDto } from "./dto/create-contact.dto";
import { UpdateContactDto } from "./dto/update-contact.dto";
import { CreateAccountDto } from "./dto/create-account.dto";
import { UpdateAccountDto } from "./dto/update-account.dto";
import { CreateOpportunityDto } from "./dto/create-opportunity.dto";
import { UpdateOpportunityDto } from "./dto/update-opportunity.dto";
import { CreateActivityDto } from "./dto/create-activity.dto";
import { ConvertLeadDto } from "./dto/convert-lead.dto";
import { AuthUser } from "../auth/interfaces/auth-user.interface";

@Injectable()
export class CRMService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly transactionHelper: TransactionHelper,
  ) {}

  // --- LEAD CRUD ---
  async createLead(dto: CreateLeadDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    if (dto.email) {
      const dup = await this.prisma.lead.findFirst({
        where: { tenantId, email: dto.email, deletedAt: null },
      });
      if (dup) {
        throw new BadRequestException(
          `Lead with email ${dto.email} already exists.`,
        );
      }
    }

    if (dto.phone) {
      const dupPhone = await this.prisma.lead.findFirst({
        where: { tenantId, phone: dto.phone, deletedAt: null },
      });
      if (dupPhone) {
        throw new BadRequestException(
          `Lead with phone number ${dto.phone} already exists.`,
        );
      }
    }

    const lead = await this.prisma.lead.create({
      data: {
        tenantId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        companyName: dto.companyName,
        email: dto.email,
        phone: dto.phone,
        source: dto.source || LeadSource.WEBSITE,
        status: LeadStatus.NEW,
      },
    });

    await this.auditService.log({
      action: "LEAD_CREATED",
      entity: "Lead",
      entityId: lead.id,
      tenantId,
      userId: user.id,
      newValues: lead,
    });

    return lead;
  }

  async getLeads(user: AuthUser) {
    return this.prisma.lead.findMany({
      where: { tenantId: user.tenantId!, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
  }

  async getLeadById(id: string, user: AuthUser) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, tenantId: user.tenantId!, deletedAt: null },
      include: { opportunities: true, activities: true },
    });
    if (!lead) {
      throw new NotFoundException(`Lead with ID ${id} not found.`);
    }
    return lead;
  }

  async updateLead(id: string, dto: UpdateLeadDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    const lead = await this.prisma.lead.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!lead) {
      throw new NotFoundException(`Lead with ID ${id} not found.`);
    }

    if (lead.status === LeadStatus.CONVERTED) {
      throw new BadRequestException(
        "Converted leads are read-only and cannot be modified.",
      );
    }

    if (lead.version !== dto.expectedVersion) {
      throw new ConflictException(
        "Optimistic lock conflict. Version mismatch.",
      );
    }

    if (dto.email && dto.email !== lead.email) {
      const dup = await this.prisma.lead.findFirst({
        where: { tenantId, email: dto.email, deletedAt: null },
      });
      if (dup) {
        throw new BadRequestException(
          `Lead with email ${dto.email} already exists.`,
        );
      }
    }

    const updated = await this.prisma.lead.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        companyName: dto.companyName,
        email: dto.email,
        phone: dto.phone,
        source: dto.source,
        status: dto.status,
        version: lead.version + 1,
      },
    });

    await this.auditService.log({
      action: "LEAD_UPDATED",
      entity: "Lead",
      entityId: id,
      tenantId,
      userId: user.id,
      newValues: updated,
    });

    return updated;
  }

  // --- LEAD TO CUSTOMER CONVERSION ---
  async convertLead(id: string, dto: ConvertLeadDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    const lead = await this.prisma.lead.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!lead) {
      throw new NotFoundException(`Lead with ID ${id} not found.`);
    }

    if (lead.status === LeadStatus.CONVERTED || lead.convertedCustomerId) {
      throw new BadRequestException("Lead has already been converted.");
    }

    const name =
      `${lead.firstName || ""} ${lead.lastName || ""}`.trim() ||
      lead.companyName ||
      "Converted Lead";

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      // Validate customer name uniqueness per tenant
      const dupCust = await tx.customer.findFirst({
        where: { tenantId, name, status: MasterStatus.ACTIVE, deletedAt: null },
      });
      if (dupCust) {
        throw new BadRequestException(
          `Customer with name "${name}" already exists.`,
        );
      }

      // 1. Create Customer
      const customer = await tx.customer.create({
        data: {
          tenantId,
          name,
          email: lead.email,
          phone: lead.phone,
          address: dto.address || "",
          status: MasterStatus.ACTIVE,
        },
      });

      // 2. Link Lead → Customer & mark Converted
      const updatedLead = await tx.lead.update({
        where: { id },
        data: {
          status: LeadStatus.CONVERTED,
          convertedCustomerId: customer.id,
          convertedAt: new Date(),
          version: lead.version + 1,
        },
      });

      // 3. Generate activity timeline entry
      await tx.cRMActivity.create({
        data: {
          tenantId,
          leadId: lead.id,
          type: CRMActivityType.FOLLOW_UP,
          subject: "Lead Converted to Customer",
          description: `Successfully converted lead to customer: ${customer.name}.`,
          activityDate: new Date(),
        },
      });

      // 4. Generate audit entry
      await tx.auditLog.create({
        data: {
          action: "LEAD_CONVERTED",
          entity: "Lead",
          entityId: id,
          tenantId,
          userId: user.id,
          newValues: JSON.parse(JSON.stringify(updatedLead)),
        },
      });

      // 5. Generate notification
      await this.notificationsService.createInternal({
        userId: user.id,
        tenantId,
        title: "Lead Converted",
        message: `Lead ${name} was converted to Customer successfully.`,
        type: NotificationType.INFO,
      });

      return { lead: updatedLead, customer };
    });
  }

  // --- CONTACTS CRUD ---
  async createContact(dto: CreateContactDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    const dup = await this.prisma.cRMContact.findFirst({
      where: { tenantId, email: dto.email, deletedAt: null },
    });
    if (dup) {
      throw new BadRequestException(
        `Contact with email ${dto.email} already exists.`,
      );
    }

    const contact = await this.prisma.cRMContact.create({
      data: {
        tenantId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        jobTitle: dto.jobTitle,
      },
    });

    await this.auditService.log({
      action: "CONTACT_CREATED",
      entity: "CRMContact",
      entityId: contact.id,
      tenantId,
      userId: user.id,
      newValues: contact,
    });

    return contact;
  }

  async getContacts(user: AuthUser) {
    return this.prisma.cRMContact.findMany({
      where: { tenantId: user.tenantId!, deletedAt: null },
      orderBy: { lastName: "asc" },
    });
  }

  async updateContact(id: string, dto: UpdateContactDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    const contact = await this.prisma.cRMContact.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!contact) {
      throw new NotFoundException(`Contact with ID ${id} not found.`);
    }

    if (contact.version !== dto.expectedVersion) {
      throw new ConflictException(
        "Optimistic lock conflict. Version mismatch.",
      );
    }

    if (dto.email && dto.email !== contact.email) {
      const dup = await this.prisma.cRMContact.findFirst({
        where: { tenantId, email: dto.email, deletedAt: null },
      });
      if (dup) {
        throw new BadRequestException(
          `Contact with email ${dto.email} already exists.`,
        );
      }
    }

    const updated = await this.prisma.cRMContact.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        jobTitle: dto.jobTitle,
        version: contact.version + 1,
      },
    });

    await this.auditService.log({
      action: "CONTACT_UPDATED",
      entity: "CRMContact",
      entityId: id,
      tenantId,
      userId: user.id,
      newValues: updated,
    });

    return updated;
  }

  // --- ACCOUNTS CRUD ---
  async createAccount(dto: CreateAccountDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    const dup = await this.prisma.cRMAccount.findFirst({
      where: { tenantId, name: dto.name, deletedAt: null },
    });
    if (dup) {
      throw new BadRequestException(
        `Account with name ${dto.name} already exists.`,
      );
    }

    const account = await this.prisma.cRMAccount.create({
      data: {
        tenantId,
        name: dto.name,
        industry: dto.industry,
        website: dto.website,
      },
    });

    await this.auditService.log({
      action: "ACCOUNT_CREATED",
      entity: "CRMAccount",
      entityId: account.id,
      tenantId,
      userId: user.id,
      newValues: account,
    });

    return account;
  }

  async getAccounts(user: AuthUser) {
    return this.prisma.cRMAccount.findMany({
      where: { tenantId: user.tenantId!, deletedAt: null },
      orderBy: { name: "asc" },
    });
  }

  async updateAccount(id: string, dto: UpdateAccountDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    const account = await this.prisma.cRMAccount.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found.`);
    }

    if (account.version !== dto.expectedVersion) {
      throw new ConflictException(
        "Optimistic lock conflict. Version mismatch.",
      );
    }

    if (dto.name && dto.name !== account.name) {
      const dup = await this.prisma.cRMAccount.findFirst({
        where: { tenantId, name: dto.name, deletedAt: null },
      });
      if (dup) {
        throw new BadRequestException(
          `Account with name ${dto.name} already exists.`,
        );
      }
    }

    const updated = await this.prisma.cRMAccount.update({
      where: { id },
      data: {
        name: dto.name,
        industry: dto.industry,
        website: dto.website,
        version: account.version + 1,
      },
    });

    await this.auditService.log({
      action: "ACCOUNT_UPDATED",
      entity: "CRMAccount",
      entityId: id,
      tenantId,
      userId: user.id,
      newValues: updated,
    });

    return updated;
  }

  // --- OPPORTUNITY CRUD ---
  async createOpportunity(dto: CreateOpportunityDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    if (dto.amount <= 0) {
      throw new BadRequestException(
        "Opportunity amount must be greater than zero.",
      );
    }
    if (dto.probability < 0 || dto.probability > 100) {
      throw new BadRequestException("Probability must be between 0 and 100.");
    }

    if (dto.leadId) {
      const lead = await this.prisma.lead.findFirst({
        where: { id: dto.leadId, tenantId, deletedAt: null },
      });
      if (!lead) {
        throw new NotFoundException(`Lead with ID ${dto.leadId} not found.`);
      }
    }
    if (dto.contactId) {
      const contact = await this.prisma.cRMContact.findFirst({
        where: { id: dto.contactId, tenantId, deletedAt: null },
      });
      if (!contact) {
        throw new NotFoundException(
          `Contact with ID ${dto.contactId} not found.`,
        );
      }
    }
    if (dto.accountId) {
      const account = await this.prisma.cRMAccount.findFirst({
        where: { id: dto.accountId, tenantId, deletedAt: null },
      });
      if (!account) {
        throw new NotFoundException(
          `Account with ID ${dto.accountId} not found.`,
        );
      }
    }

    const opportunity = await this.prisma.opportunity.create({
      data: {
        tenantId,
        name: dto.name,
        leadId: dto.leadId,
        contactId: dto.contactId,
        accountId: dto.accountId,
        stage: dto.stage || OpportunityStage.QUALIFICATION,
        amount: new Prisma.Decimal(dto.amount),
        probability: new Prisma.Decimal(dto.probability),
        expectedCloseDate: dto.expectedCloseDate
          ? new Date(dto.expectedCloseDate)
          : null,
      },
    });

    await this.auditService.log({
      action: "OPPORTUNITY_CREATED",
      entity: "Opportunity",
      entityId: opportunity.id,
      tenantId,
      userId: user.id,
      newValues: opportunity,
    });

    return opportunity;
  }

  async getOpportunities(user: AuthUser) {
    return this.prisma.opportunity.findMany({
      where: { tenantId: user.tenantId!, deletedAt: null },
      include: { lead: true, contact: true, account: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async getOpportunityById(id: string, user: AuthUser) {
    const opp = await this.prisma.opportunity.findFirst({
      where: { id, tenantId: user.tenantId!, deletedAt: null },
      include: { lead: true, contact: true, account: true, activities: true },
    });
    if (!opp) {
      throw new NotFoundException(`Opportunity with ID ${id} not found.`);
    }
    return opp;
  }

  async updateOpportunity(
    id: string,
    dto: UpdateOpportunityDto,
    user: AuthUser,
  ) {
    const tenantId = user.tenantId!;

    const opp = await this.prisma.opportunity.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!opp) {
      throw new NotFoundException(`Opportunity with ID ${id} not found.`);
    }

    if (
      opp.stage === OpportunityStage.WON ||
      opp.stage === OpportunityStage.LOST
    ) {
      throw new BadRequestException(
        "Closed opportunities (Won/Lost) are read-only and cannot be modified.",
      );
    }

    if (opp.version !== dto.expectedVersion) {
      throw new ConflictException(
        "Optimistic lock conflict. Version mismatch.",
      );
    }

    if (dto.amount !== undefined && dto.amount <= 0) {
      throw new BadRequestException(
        "Opportunity amount must be greater than zero.",
      );
    }

    if (
      dto.probability !== undefined &&
      (dto.probability < 0 || dto.probability > 100)
    ) {
      throw new BadRequestException("Probability must be between 0 and 100.");
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const updated = await tx.opportunity.update({
        where: { id },
        data: {
          name: dto.name,
          contactId: dto.contactId,
          accountId: dto.accountId,
          stage: dto.stage,
          amount:
            dto.amount !== undefined
              ? new Prisma.Decimal(dto.amount)
              : undefined,
          probability:
            dto.probability !== undefined
              ? new Prisma.Decimal(dto.probability)
              : undefined,
          expectedCloseDate: dto.expectedCloseDate
            ? new Date(dto.expectedCloseDate)
            : undefined,
          version: opp.version + 1,
        },
      });

      const isWon = dto.stage === OpportunityStage.WON;
      const isLost = dto.stage === OpportunityStage.LOST;
      const auditAction = isWon
        ? "OPPORTUNITY_WON"
        : isLost
          ? "OPPORTUNITY_LOST"
          : "OPPORTUNITY_UPDATED";

      await tx.auditLog.create({
        data: {
          action: auditAction,
          entity: "Opportunity",
          entityId: id,
          tenantId,
          userId: user.id,
          newValues: JSON.parse(JSON.stringify(updated)),
        },
      });

      if (isWon || isLost) {
        await this.notificationsService.createInternal({
          userId: user.id,
          tenantId,
          title: isWon ? "Opportunity Won" : "Opportunity Lost",
          message: `Opportunity "${opp.name}" has been marked as ${dto.stage!.toLowerCase()}.`,
          type: NotificationType.INFO,
        });
      }

      return updated;
    });
  }

  // --- CRM ACTIVITY LOGGING ---
  async createActivity(dto: CreateActivityDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    if (dto.leadId) {
      const lead = await this.prisma.lead.findFirst({
        where: { id: dto.leadId, tenantId, deletedAt: null },
      });
      if (!lead) {
        throw new NotFoundException(`Lead with ID ${dto.leadId} not found.`);
      }
    }

    if (dto.opportunityId) {
      const opp = await this.prisma.opportunity.findFirst({
        where: { id: dto.opportunityId, tenantId, deletedAt: null },
      });
      if (!opp) {
        throw new NotFoundException(
          `Opportunity with ID ${dto.opportunityId} not found.`,
        );
      }
    }

    const activity = await this.prisma.cRMActivity.create({
      data: {
        tenantId,
        leadId: dto.leadId,
        opportunityId: dto.opportunityId,
        type: dto.type,
        subject: dto.subject,
        description: dto.description,
        activityDate: new Date(dto.activityDate),
      },
    });

    await this.auditService.log({
      action: "CRM_ACTIVITY_CREATED",
      entity: "CRMActivity",
      entityId: activity.id,
      tenantId,
      userId: user.id,
      newValues: activity,
    });

    return activity;
  }

  async getTimeline(
    entityId: string,
    type: "lead" | "opportunity",
    user: AuthUser,
  ) {
    const tenantId = user.tenantId!;

    const filter =
      type === "lead" ? { leadId: entityId } : { opportunityId: entityId };

    return this.prisma.cRMActivity.findMany({
      where: {
        tenantId,
        ...filter,
      },
      orderBy: { activityDate: "desc" },
    });
  }

  // --- CRM SALES DASHBOARD ---
  async getDashboardSummary(user: AuthUser) {
    const tenantId = user.tenantId!;

    // Total Leads
    const totalLeads = await this.prisma.lead.count({
      where: { tenantId, deletedAt: null },
    });

    // Qualified Leads
    const qualifiedLeads = await this.prisma.lead.count({
      where: { tenantId, status: LeadStatus.QUALIFIED, deletedAt: null },
    });

    // Converted Leads
    const convertedLeads = await this.prisma.lead.count({
      where: { tenantId, status: LeadStatus.CONVERTED, deletedAt: null },
    });

    // Conversion Rate
    let conversionRate = 0;
    if (totalLeads > 0) {
      conversionRate = Number(((convertedLeads / totalLeads) * 100).toFixed(2));
    }

    // Active Opportunities
    const activeOpps = await this.prisma.opportunity.findMany({
      where: {
        tenantId,
        stage: {
          in: [
            OpportunityStage.QUALIFICATION,
            OpportunityStage.PROPOSAL,
            OpportunityStage.NEGOTIATION,
          ],
        },
        deletedAt: null,
      },
    });

    let pipelineValue = new Prisma.Decimal(0);
    let forecastedRevenue = new Prisma.Decimal(0);

    for (const opp of activeOpps) {
      const amt = new Prisma.Decimal(opp.amount);
      const prob = new Prisma.Decimal(opp.probability);

      pipelineValue = pipelineValue.add(amt);
      forecastedRevenue = forecastedRevenue.add(amt.mul(prob).div(100));
    }

    // Upcoming Activities
    const upcomingActivities = await this.prisma.cRMActivity.count({
      where: {
        tenantId,
        activityDate: { gte: new Date() },
      },
    });

    return {
      totalLeads,
      qualifiedLeads,
      conversionRate,
      activeOpportunities: activeOpps.length,
      pipelineValue: pipelineValue.toString(),
      forecastedRevenue: forecastedRevenue.toString(),
      upcomingActivities,
    };
  }
}
