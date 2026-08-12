import {
  Injectable,
  Inject,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { TransactionHelper } from "../../common/transactions/transaction.helper";
import { AuditService } from "../../common/audit/audit.service";
import { MediaService } from "../media/media.service";
import { NotificationsService } from "../notifications/notifications.service";
import { NotificationType } from "../notifications/dto/query-notification.dto";
import {
  REPORT_EXPORTERS,
  ReportExporter,
} from "./exporters/report-exporter.interface";
import { CreateReportDto } from "./dto/create-report.dto";
import { QueryReportDto } from "./dto/query-report.dto";
import { DeleteReportDto } from "./dto/delete-report.dto";
import { AuthUser } from "../auth/interfaces/auth-user.interface";
import { Prisma } from "@amdox/database/generated";

@Injectable()
export class ReportingService {
  private readonly logger = new Logger(ReportingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly transactionHelper: TransactionHelper,
    private readonly mediaService: MediaService,
    private readonly notificationsService: NotificationsService,
    @Inject(REPORT_EXPORTERS)
    private readonly exporters: ReportExporter[],
  ) {}

  async create(dto: CreateReportDto, user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required to request reports.");
    }

    const format = dto.format || "csv";
    const exporter = this.exporters.find((e) => e.supports(format));
    if (!exporter) {
      throw new BadRequestException(
        `Export format '${format}' is not supported.`,
      );
    }

    // 1. Create PENDING ReportJob record
    const job = await this.transactionHelper.run(async (tx) => {
      const record = await tx.reportJob.create({
        data: {
          tenantId: user.tenantId!,
          requestedBy: user.id,
          type: dto.type,
          status: "PENDING",
          filters: (dto.filters as Prisma.InputJsonValue) || {},
        },
        select: {
          id: true,
          tenantId: true,
          requestedBy: true,
          type: true,
          status: true,
          version: true,
          createdAt: true,
        },
      });

      await this.auditService.log(
        {
          action: "REPORT_REQUESTED",
          entity: "ReportJob",
          entityId: record.id,
          newValues: {
            id: record.id,
            type: record.type,
          },
        },
        tx,
      );

      return record;
    });

    // 2. Spawn background processing without blocking response
    this.processExportAsync(job.id, format, user).catch((err) => {
      this.logger.error(
        `Failed to process report job ${job.id} asynchronously: ${err.message}`,
      );
    });

    return job;
  }

  private async processExportAsync(
    jobId: string,
    format: string,
    user: AuthUser,
  ) {
    try {
      const job = await this.prisma.reportJob.findUnique({
        where: { id: jobId },
      });

      if (!job || job.status !== "PENDING") {
        return;
      }

      const exporter = this.exporters.find((e) => e.supports(format))!;
      let headers: string[] = [];
      let getRows: () => AsyncGenerator<unknown[], void, unknown>;

      const filters = (job.filters as Record<string, unknown>) || {};

      // Configure exporters and row generators based on report type
      if (job.type === "AUDIT_LOGS") {
        headers = [
          "ID",
          "Timestamp",
          "User ID",
          "Entity",
          "Entity ID",
          "Action",
          "IP Address",
          "User Agent",
        ];
        const prismaClient = this.prisma;
        getRows = async function* () {
          let skip = 0;
          const take = 100;
          const whereClause: Prisma.AuditLogWhereInput = {
            tenantId: user.tenantId,
          };
          if (filters.action) {
            whereClause.action = String(filters.action);
          }
          if (filters.entity) {
            whereClause.entity = String(filters.entity);
          }

          while (true) {
            const logs = await prismaClient.auditLog.findMany({
              where: whereClause,
              orderBy: { createdAt: "asc" },
              skip,
              take,
              select: {
                id: true,
                createdAt: true,
                userId: true,
                entity: true,
                entityId: true,
                action: true,
                ipAddress: true,
                userAgent: true,
              },
            });

            if (logs.length === 0) break;

            for (const log of logs) {
              yield [
                log.id,
                log.createdAt.toISOString(),
                log.userId || "",
                log.entity,
                log.entityId || "",
                log.action,
                log.ipAddress || "",
                log.userAgent || "",
              ];
            }
            skip += take;
          }
        };
      } else if (job.type === "USER_ACTIVITIES") {
        headers = ["ID", "Username", "Email", "Is Active", "Created At"];
        const prismaClient = this.prisma;
        getRows = async function* () {
          let skip = 0;
          const take = 100;
          while (true) {
            const users = await prismaClient.user.findMany({
              where: { tenantId: user.tenantId },
              orderBy: { createdAt: "asc" },
              skip,
              take,
              select: {
                id: true,
                username: true,
                email: true,
                deletedAt: true,
                createdAt: true,
              },
            });

            if (users.length === 0) break;

            for (const u of users) {
              yield [
                u.id,
                u.username,
                u.email,
                u.deletedAt ? "INACTIVE" : "ACTIVE",
                u.createdAt.toISOString(),
              ];
            }
            skip += take;
          }
        };
      } else if (job.type === "ORGANIZATION_STATS") {
        headers = ["Metric Name", "Metric Value"];
        const prismaClient = this.prisma;
        getRows = async function* () {
          const [usersCount, rolesCount, notificationsCount] =
            await Promise.all([
              prismaClient.user.count({ where: { tenantId: user.tenantId } }),
              prismaClient.role.count({ where: { tenantId: user.tenantId } }),
              prismaClient.notification.count({
                where: { tenantId: user.tenantId },
              }),
            ]);
          yield ["Total Users", usersCount];
          yield ["Total Roles", rolesCount];
          yield ["Total Notifications", notificationsCount];
        };
      } else {
        throw new Error(`Unknown report type: ${job.type}`);
      }

      // Generate the CSV stream
      const stream = await exporter.export(headers, getRows);

      // Buffer stream into memory for reuse of MediaService upload
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);

      const mockFile = {
        fieldname: "file",
        originalname: `${job.type.toLowerCase()}_report_${Date.now()}.${exporter.getFileExtension()}`,
        encoding: "7bit",
        mimetype: exporter.getMimeType(),
        size: buffer.length,
        buffer,
      };

      // Call MediaService to persist the file
      const mediaFile = await this.mediaService.upload(
        mockFile,
        { isPublic: false },
        user,
      );

      // Update ReportJob status to COMPLETED inside transaction
      await this.transactionHelper.run(async (tx) => {
        await tx.reportJob.update({
          where: { id: jobId },
          data: {
            status: "COMPLETED",
            mediaFileId: mediaFile.id,
            version: { increment: 1 },
          },
        });

        await this.auditService.log(
          {
            action: "REPORT_COMPLETED",
            entity: "ReportJob",
            entityId: jobId,
            newValues: {
              status: "COMPLETED",
              mediaFileId: mediaFile.id,
            },
          },
          tx,
        );
      });

      // Dispatch completion notification
      await this.notificationsService.createInternal({
        userId: user.id,
        tenantId: user.tenantId,
        title: "Report Generation Completed",
        message: `Your ${job.type} report has been successfully generated.`,
        type: NotificationType.SUCCESS,
        metadata: { jobId, mediaFileId: mediaFile.id },
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error processing report job ${jobId}: ${errorMsg}`);

      // Mark report job as FAILED
      await this.transactionHelper.run(async (tx) => {
        await tx.reportJob.update({
          where: { id: jobId },
          data: {
            status: "FAILED",
            errorMessage: errorMsg,
            version: { increment: 1 },
          },
        });
      });

      // Dispatch failure notification
      await this.notificationsService.createInternal({
        userId: user.id,
        tenantId: user.tenantId,
        title: "Report Generation Failed",
        message: `Failed to generate your ${jobId} report: ${errorMsg}`,
        type: NotificationType.ERROR,
        metadata: { jobId },
      });
    }
  }

  async findAll(query: QueryReportDto, user: AuthUser) {
    const where: Prisma.ReportJobWhereInput = {
      tenantId: user.tenantId,
      deletedAt: null,
    };

    if (query.type) {
      where.type = query.type;
    }

    if (query.status) {
      where.status = query.status;
    }

    const createdAtFilter: Prisma.DateTimeFilter = {};
    let hasDateFilter = false;

    if (query.startDate) {
      createdAtFilter.gte = new Date(query.startDate);
      hasDateFilter = true;
    }
    if (query.endDate) {
      createdAtFilter.lte = new Date(query.endDate);
      hasDateFilter = true;
    }
    if (query.createdAtFrom) {
      createdAtFilter.gte = new Date(query.createdAtFrom);
      hasDateFilter = true;
    }
    if (query.createdAtTo) {
      createdAtFilter.lte = new Date(query.createdAtTo);
      hasDateFilter = true;
    }

    if (hasDateFilter) {
      where.createdAt = createdAtFilter;
    }

    const sortField = query.sort || "createdAt";
    const order = query.order || "desc";

    const [total, items] = await Promise.all([
      this.prisma.reportJob.count({ where }),
      this.prisma.reportJob.findMany({
        where,
        orderBy: { [sortField]: order },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          tenantId: true,
          requestedBy: true,
          type: true,
          status: true,
          filters: true,
          mediaFileId: true,
          errorMessage: true,
          version: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    const totalPages = Math.ceil(total / query.limit);

    return {
      data: items,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPreviousPage: query.page > 1,
      },
    };
  }

  async findOne(id: string, user: AuthUser) {
    const job = await this.prisma.reportJob.findUnique({
      where: { id },
    });

    if (!job || job.deletedAt) {
      throw new NotFoundException("Report job not found");
    }

    // Tenant Isolation
    if (job.tenantId !== user.tenantId) {
      throw new ForbiddenException("Access denied to cross-tenant report job.");
    }

    return {
      id: job.id,
      tenantId: job.tenantId,
      requestedBy: job.requestedBy,
      type: job.type,
      status: job.status,
      filters: job.filters,
      mediaFileId: job.mediaFileId,
      errorMessage: job.errorMessage,
      version: job.version,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  async delete(id: string, dto: DeleteReportDto, user: AuthUser) {
    return this.transactionHelper.run(async (tx) => {
      const job = await tx.reportJob.findUnique({
        where: { id },
      });

      if (!job || job.deletedAt) {
        throw new NotFoundException("Report job not found");
      }

      // Tenant Isolation & Ownership
      if (job.tenantId !== user.tenantId) {
        throw new ForbiddenException(
          "Access denied to cross-tenant report job.",
        );
      }

      // Optimistic concurrency check
      if (
        dto.expectedVersion !== undefined &&
        job.version !== dto.expectedVersion
      ) {
        throw new ConflictException(
          "Concurrent modification error: Version mismatch",
        );
      }

      await tx.reportJob.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          version: { increment: 1 },
        },
      });

      await this.auditService.log(
        {
          action: "REPORT_DELETED",
          entity: "ReportJob",
          entityId: job.id,
          newValues: {
            deletedId: job.id,
            type: job.type,
          },
        },
        tx,
      );

      return { success: true };
    });
  }

  async getDownloadStream(id: string, user: AuthUser) {
    const job = await this.prisma.reportJob.findUnique({
      where: { id },
    });

    if (!job || job.deletedAt) {
      throw new NotFoundException("Report job not found");
    }

    // Tenant and Report Ownership Isolation
    if (job.tenantId !== user.tenantId) {
      throw new ForbiddenException("Access denied to cross-tenant report job.");
    }

    if (job.status !== "COMPLETED") {
      throw new BadRequestException("Report generation has not completed yet.");
    }

    if (!job.mediaFileId) {
      throw new NotFoundException("Linked media file not found.");
    }

    // Reuse MediaService download logic
    const downloadData = await this.mediaService.getDownloadStream(
      job.mediaFileId,
      user,
    );

    // Track download in audit log
    await this.transactionHelper.run(async (tx) => {
      await this.auditService.log(
        {
          action: "REPORT_DOWNLOADED",
          entity: "ReportJob",
          entityId: job.id,
          newValues: {
            downloadedId: job.id,
            type: job.type,
            mediaFileId: job.mediaFileId,
          },
        },
        tx,
      );
    });

    return downloadData;
  }
}
