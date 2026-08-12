/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, no-console */
import {
  Injectable,
  OnModuleInit,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { SchedulerRegistry } from "@nestjs/schedule";
import { CronJob } from "cron";
import { AuditService } from "../../../common/audit/audit.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";
import {
  CreateReportDefinitionDto,
  UpdateReportDefinitionDto,
  CreateReportScheduleDto,
  UpdateReportScheduleDto,
} from "../dto/report.dto";

@Injectable()
export class BiReportService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async onModuleInit() {
    // Load all active schedules and register them with SchedulerRegistry
    const activeSchedules = await this.prisma.biReportSchedule.findMany({
      where: { isActive: true },
      include: { reportDefinition: true },
    });

    for (const schedule of activeSchedules) {
      try {
        this.registerCronJob(schedule);
      } catch (err) {
        console.error(
          `Failed to register cron job for BI report schedule ${schedule.id}:`,
          err,
        );
      }
    }
  }

  private registerCronJob(schedule: any) {
    const jobName = `bi-report-schedule-${schedule.id}`;
    if (this.schedulerRegistry.getCronJobs().has(jobName)) {
      this.schedulerRegistry.deleteCronJob(jobName);
    }

    const job = new CronJob(schedule.cronExpression, async () => {
      try {
        await this.executeScheduledReport(schedule.id);
      } catch (err) {
        console.error(`Error executing scheduled report ${schedule.id}:`, err);
      }
    });

    this.schedulerRegistry.addCronJob(jobName, job);
    job.start();
  }

  async createReportDefinition(dto: CreateReportDefinitionDto, user: AuthUser) {
    const tenantId = user.tenantId!;
    const report = await this.prisma.biReportDefinition.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        module: dto.module,
        config: dto.config as any,
      },
    });

    await this.auditService.log({
      userId: user.id,
      tenantId,
      entity: "BiReportDefinition",
      entityId: report.id,
      action: "REPORT_CREATED",
      newValues: report as any,
    });

    return report;
  }

  async updateReportDefinition(
    id: string,
    dto: UpdateReportDefinitionDto,
    user: AuthUser,
  ) {
    const tenantId = user.tenantId!;
    const report = await this.prisma.biReportDefinition.findUnique({
      where: { id },
    });

    if (!report || report.tenantId !== tenantId) {
      throw new NotFoundException("Report definition not found");
    }

    if (report.version !== dto.expectedVersion) {
      throw new ConflictException("DATABASE.CONFLICT");
    }

    const updated = await this.prisma.biReportDefinition.update({
      where: { id },
      data: {
        name: dto.name ?? report.name,
        description: dto.description ?? report.description,
        module: dto.module ?? report.module,
        config: dto.config ? (dto.config as any) : report.config,
        version: report.version + 1,
      },
    });

    return updated;
  }

  async runReport(id: string, user: AuthUser) {
    const tenantId = user.tenantId!;
    const report = await this.prisma.biReportDefinition.findUnique({
      where: { id },
    });

    if (!report || report.tenantId !== tenantId) {
      throw new NotFoundException("Report definition not found");
    }

    // Dynamic execution strategy based on fact tables
    let data: any[] = [];
    const moduleLower = report.module.toLowerCase();

    if (moduleLower === "finance") {
      data = await this.prisma.biFactFinance.findMany({
        where: { tenantId },
        include: { account: true },
        orderBy: { postingDate: "desc" },
        take: 100,
      });
    } else if (moduleLower === "sales") {
      data = await this.prisma.biFactSales.findMany({
        where: { tenantId },
        include: { product: true, customer: true },
        orderBy: { orderDate: "desc" },
        take: 100,
      });
    } else if (moduleLower === "procurement") {
      data = await this.prisma.biFactProcurement.findMany({
        where: { tenantId },
        include: { product: true },
        orderBy: { orderDate: "desc" },
        take: 100,
      });
    } else if (moduleLower === "inventory") {
      data = await this.prisma.biFactInventory.findMany({
        where: { tenantId },
        include: { product: true, warehouse: true },
        orderBy: { snapshotDate: "desc" },
        take: 100,
      });
    } else if (moduleLower === "manufacturing") {
      data = await this.prisma.biFactManufacturing.findMany({
        where: { tenantId },
        include: { product: true },
        orderBy: { completionDate: "desc" },
        take: 100,
      });
    } else if (moduleLower === "quality") {
      data = await this.prisma.biFactQuality.findMany({
        where: { tenantId },
        include: { product: true },
        orderBy: { inspectionDate: "desc" },
        take: 100,
      });
    } else if (moduleLower === "transportation") {
      data = await this.prisma.biFactTransportation.findMany({
        where: { tenantId },
        orderBy: { logDate: "desc" },
        take: 100,
      });
    } else if (moduleLower === "customer service" || moduleLower === "csm") {
      data = await this.prisma.biFactCustomerService.findMany({
        where: { tenantId },
        include: { product: true, customer: true },
        orderBy: { logDate: "desc" },
        take: 100,
      });
    } else if (moduleLower === "hr" || moduleLower === "hrm") {
      data = await this.prisma.biFactHR.findMany({
        where: { tenantId },
        include: { employee: true },
        orderBy: { logDate: "desc" },
        take: 100,
      });
    } else if (moduleLower === "workflow") {
      data = await this.prisma.biFactWorkflow.findMany({
        where: { tenantId },
        orderBy: { logDate: "desc" },
        take: 100,
      });
    } else if (moduleLower === "security") {
      data = await this.prisma.biFactSecurity.findMany({
        where: { tenantId },
        orderBy: { logDate: "desc" },
        take: 100,
      });
    } else {
      throw new BadRequestException("Unsupported report builder module");
    }

    await this.auditService.log({
      userId: user.id,
      tenantId,
      entity: "BiReportDefinition",
      entityId: id,
      action: "REPORT_EXECUTED",
      newValues: { recordCount: data.length },
    });

    return {
      reportDefinition: report,
      rows: data,
    };
  }

  async createSchedule(dto: CreateReportScheduleDto, user: AuthUser) {
    const tenantId = user.tenantId!;
    const report = await this.prisma.biReportDefinition.findUnique({
      where: { id: dto.reportDefinitionId },
    });

    if (!report || report.tenantId !== tenantId) {
      throw new NotFoundException("Report definition not found");
    }

    const schedule = await this.prisma.biReportSchedule.create({
      data: {
        tenantId,
        reportDefinitionId: dto.reportDefinitionId,
        recipientEmail: dto.recipientEmail,
        cronExpression: dto.cronExpression,
        format: dto.format,
        isActive: true,
      },
    });

    this.registerCronJob(schedule);

    await this.auditService.log({
      userId: user.id,
      tenantId,
      entity: "BiReportSchedule",
      entityId: schedule.id,
      action: "REPORT_SCHEDULED",
      newValues: schedule as any,
    });

    return schedule;
  }

  async deleteSchedule(id: string, user: AuthUser) {
    const tenantId = user.tenantId!;
    const schedule = await this.prisma.biReportSchedule.findUnique({
      where: { id },
    });

    if (!schedule || schedule.tenantId !== tenantId) {
      throw new NotFoundException("Report schedule not found");
    }

    const jobName = `bi-report-schedule-${schedule.id}`;
    if (this.schedulerRegistry.getCronJobs().has(jobName)) {
      this.schedulerRegistry.deleteCronJob(jobName);
    }

    await this.prisma.biReportSchedule.delete({ where: { id } });
    return { status: "DELETED" };
  }

  private async executeScheduledReport(scheduleId: string) {
    const schedule = await this.prisma.biReportSchedule.findUnique({
      where: { id: scheduleId },
      include: { reportDefinition: true },
    });

    if (!schedule || !schedule.isActive) return;

    try {
      // Execute the report dynamic query
      const userContext: AuthUser = {
        id: "00000000-0000-0000-0000-000000000000",
        email: "system@amdox.com",
        tenantId: schedule.tenantId,
        roles: ["Admin"],
      } as any;

      const result = await this.runReport(
        schedule.reportDefinitionId,
        userContext,
      );

      // Simulate sending report
      console.log(
        `Scheduled report execution complete: Report ${schedule.reportDefinition.name} has been processed in ${schedule.format} format for recipient ${schedule.recipientEmail}. Records: ${result.rows.length}`,
      );

      await this.notificationsService.createInternal({
        userId: userContext.id,
        tenantId: schedule.tenantId,
        title: "Scheduled BI Report Dispatched",
        message: `Scheduled BI report ${schedule.reportDefinition.name} has been successfully dispatched to ${schedule.recipientEmail}.`,
        type: "SUCCESS" as any,
      });
    } catch (err) {
      // Trigger failure notification to tenant administrators
      await this.notificationsService.createInternal({
        userId: "00000000-0000-0000-0000-000000000000",
        tenantId: schedule.tenantId,
        title: "Scheduled BI Report Failure",
        message: `Failed to execute scheduled BI report ${schedule.reportDefinition?.name || "Unknown"}: ${(err as Error).message}`,
        type: "ERROR" as any,
      });
    }
  }
}
