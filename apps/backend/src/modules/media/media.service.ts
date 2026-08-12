import {
  Injectable,
  Inject,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "@amdox/database";
import { TransactionHelper } from "../../common/transactions/transaction.helper";
import { AuditService } from "../../common/audit/audit.service";
import {
  STORAGE_PROVIDER_TOKEN,
  StorageProvider,
  MulterFile,
} from "./storage/storage-provider.interface";
import { CreateMediaDto } from "./dto/create-media.dto";
import { QueryMediaDto, MediaFileType } from "./dto/query-media.dto";
import { UpdateMediaDto } from "./dto/update-media.dto";
import { DeleteMediaDto } from "./dto/delete-media.dto";
import { RestoreMediaDto } from "./dto/restore-media.dto";
import { AuthUser } from "../auth/interfaces/auth-user.interface";
import { Prisma } from "@amdox/database/generated";
import * as crypto from "crypto";
import * as path from "path";

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly uploadMaxSize: number;
  private readonly allowedMimeTypes: string[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly transactionHelper: TransactionHelper,
    private readonly configService: ConfigService,
    @Inject(STORAGE_PROVIDER_TOKEN)
    private readonly storageProvider: StorageProvider,
  ) {
    this.uploadMaxSize =
      this.configService.get<number>("uploadMaxSize") || 10485760;
    this.allowedMimeTypes =
      this.configService.get<string[]>("allowedMimeTypes") || [];
  }

  async upload(file: MulterFile, dto: CreateMediaDto, user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required for file upload.");
    }

    // 1. Validate file size
    if (file.size > this.uploadMaxSize) {
      throw new BadRequestException(
        `File size exceeds maximum limit of ${this.uploadMaxSize} bytes.`,
      );
    }

    // 2. Validate dangerous extensions and MIME types
    const ext = path.extname(file.originalname).toLowerCase();
    const dangerousExtensions = [
      ".exe",
      ".bat",
      ".cmd",
      ".sh",
      ".msi",
      ".js",
      ".jse",
      ".vbs",
      ".vbe",
      ".wsf",
      ".wsh",
    ];
    if (dangerousExtensions.includes(ext)) {
      throw new BadRequestException("Dangerous file type upload rejected.");
    }

    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `MIME type '${file.mimetype}' is not allowed.`,
      );
    }

    // 3. Map MIME type to MediaFileType enum
    let type: MediaFileType = MediaFileType.OTHER;
    const mime = file.mimetype.toLowerCase();

    if (mime.startsWith("image/")) {
      type = MediaFileType.IMAGE;
    } else if (mime === "application/pdf") {
      type = MediaFileType.PDF;
    } else if (mime.startsWith("video/")) {
      type = MediaFileType.VIDEO;
    } else if (mime.startsWith("audio/")) {
      type = MediaFileType.AUDIO;
    } else if (
      mime === "application/zip" ||
      mime === "application/x-zip-compressed" ||
      mime === "application/x-tar" ||
      mime === "application/x-gzip" ||
      mime === "application/x-bzip2" ||
      mime === "application/x-7z-compressed" ||
      mime === "application/vnd.rar"
    ) {
      type = MediaFileType.ARCHIVE;
    } else if (
      mime.startsWith("text/") ||
      mime === "application/msword" ||
      mime ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mime === "application/vnd.ms-excel" ||
      mime ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      mime === "application/vnd.ms-powerpoint" ||
      mime ===
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ) {
      type = MediaFileType.DOCUMENT;
    }

    // 4. Stored name generation (sanitize original name and prepend UUID)
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueId = crypto.randomUUID();
    const storedName = `${uniqueId}_${sanitizedName}`;

    // 5. Generate checksum
    const checksum = crypto
      .createHash("sha256")
      .update(file.buffer)
      .digest("hex");

    // 6. Upload file via Storage Provider
    const storagePath = await this.storageProvider.upload(
      file,
      storedName,
      user.tenantId,
    );

    // 7. Persist metadata in database inside transaction
    return this.transactionHelper.run(async (tx) => {
      const mediaFile = await tx.mediaFile.create({
        data: {
          tenantId: user.tenantId!,
          uploadedBy: user.id,
          originalName: file.originalname,
          storedName,
          mimeType: file.mimetype,
          extension: ext.replace(".", ""),
          size: file.size,
          type,
          storageProvider: "local",
          storagePath,
          checksum,
          isPublic: dto.isPublic || false,
        },
        select: {
          id: true,
          tenantId: true,
          uploadedBy: true,
          originalName: true,
          mimeType: true,
          extension: true,
          size: true,
          type: true,
          isPublic: true,
          version: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await this.auditService.log(
        {
          action: "MEDIA_CREATED",
          entity: "MediaFile",
          entityId: mediaFile.id,
          newValues: {
            id: mediaFile.id,
            originalName: mediaFile.originalName,
            size: mediaFile.size,
            type: mediaFile.type,
          },
        },
        tx,
      );

      return mediaFile;
    });
  }

  async findAll(query: QueryMediaDto, user: AuthUser) {
    const isTenantAdmin = user.roles?.includes("Admin");
    const where: Prisma.MediaFileWhereInput = {};

    // Tenant Isolation
    where.tenantId = user.tenantId;

    // Filters
    if (query.filename) {
      where.originalName = {
        contains: query.filename,
        mode: "insensitive",
      };
    }

    if (query.mimeType) {
      where.mimeType = {
        contains: query.mimeType,
        mode: "insensitive",
      };
    }

    if (query.type) {
      where.type = query.type;
    }

    // Soft delete filter
    const includeDeleted = query.includeDeleted === true && isTenantAdmin;
    if (!includeDeleted) {
      where.deletedAt = null;
    }

    // Date range filters
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

    // Sorting
    const sortField = query.sort || "createdAt";
    const order = query.order || "desc";

    const [total, items] = await Promise.all([
      this.prisma.mediaFile.count({ where }),
      this.prisma.mediaFile.findMany({
        where,
        orderBy: { [sortField]: order },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          tenantId: true,
          uploadedBy: true,
          originalName: true,
          mimeType: true,
          extension: true,
          size: true,
          type: true,
          isPublic: true,
          version: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
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
    const record = await this.prisma.mediaFile.findUnique({
      where: { id },
    });

    if (!record || record.deletedAt) {
      throw new NotFoundException("Media file not found");
    }

    // Tenant Isolation
    if (record.tenantId !== user.tenantId) {
      throw new ForbiddenException(
        "Access denied to cross-tenant media resource.",
      );
    }

    return {
      id: record.id,
      tenantId: record.tenantId,
      uploadedBy: record.uploadedBy,
      originalName: record.originalName,
      mimeType: record.mimeType,
      extension: record.extension,
      size: record.size,
      type: record.type,
      isPublic: record.isPublic,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async update(id: string, dto: UpdateMediaDto, user: AuthUser) {
    return this.transactionHelper.run(async (tx) => {
      const record = await tx.mediaFile.findUnique({
        where: { id },
      });

      if (!record || record.deletedAt) {
        throw new NotFoundException("Media file not found");
      }

      // Tenant Isolation
      if (record.tenantId !== user.tenantId) {
        throw new ForbiddenException(
          "Access denied to cross-tenant media resource.",
        );
      }

      // Optimistic concurrency validation
      if (
        dto.expectedVersion !== undefined &&
        record.version !== dto.expectedVersion
      ) {
        throw new ConflictException(
          "Concurrent modification error: Version mismatch",
        );
      }

      const updateData: Prisma.MediaFileUpdateInput = {};
      const changes: Record<string, Record<string, unknown>> = {};

      if (
        dto.originalName !== undefined &&
        dto.originalName !== record.originalName
      ) {
        updateData.originalName = dto.originalName;
        changes.originalName = {
          old: record.originalName,
          new: dto.originalName,
        };
      }

      if (dto.isPublic !== undefined && dto.isPublic !== record.isPublic) {
        updateData.isPublic = dto.isPublic;
        changes.isPublic = { old: record.isPublic, new: dto.isPublic };
      }

      // Check if there are any actual changes
      if (Object.keys(updateData).length === 0) {
        return { success: true };
      }

      updateData.version = { increment: 1 };

      await tx.mediaFile.update({
        where: { id },
        data: updateData,
      });

      await this.auditService.log(
        {
          action: "MEDIA_UPDATED",
          entity: "MediaFile",
          entityId: record.id,
          newValues: changes,
        },
        tx,
      );

      return { success: true };
    });
  }

  async delete(id: string, dto: DeleteMediaDto, user: AuthUser) {
    return this.transactionHelper.run(async (tx) => {
      const record = await tx.mediaFile.findUnique({
        where: { id },
      });

      if (!record || record.deletedAt) {
        throw new NotFoundException("Media file not found");
      }

      // Tenant Isolation
      if (record.tenantId !== user.tenantId) {
        throw new ForbiddenException(
          "Access denied to cross-tenant media resource.",
        );
      }

      // Optimistic concurrency validation
      if (
        dto.expectedVersion !== undefined &&
        record.version !== dto.expectedVersion
      ) {
        throw new ConflictException(
          "Concurrent modification error: Version mismatch",
        );
      }

      await tx.mediaFile.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          version: { increment: 1 },
        },
      });

      await this.auditService.log(
        {
          action: "MEDIA_DELETED",
          entity: "MediaFile",
          entityId: record.id,
          newValues: {
            deletedId: record.id,
            originalName: record.originalName,
          },
        },
        tx,
      );

      return { success: true };
    });
  }

  async restore(id: string, dto: RestoreMediaDto, user: AuthUser) {
    return this.transactionHelper.run(async (tx) => {
      const record = await tx.mediaFile.findUnique({
        where: { id },
      });

      if (!record) {
        throw new NotFoundException("Media file not found");
      }

      // Tenant Isolation
      if (record.tenantId !== user.tenantId) {
        throw new ForbiddenException(
          "Access denied to cross-tenant media resource.",
        );
      }

      if (!record.deletedAt) {
        throw new BadRequestException("Media file is not deleted.");
      }

      // Optimistic concurrency validation
      if (
        dto.expectedVersion !== undefined &&
        record.version !== dto.expectedVersion
      ) {
        throw new ConflictException(
          "Concurrent modification error: Version mismatch",
        );
      }

      await tx.mediaFile.update({
        where: { id },
        data: {
          deletedAt: null,
          version: { increment: 1 },
        },
      });

      await this.auditService.log(
        {
          action: "MEDIA_RESTORED",
          entity: "MediaFile",
          entityId: record.id,
          newValues: {
            restoredId: record.id,
            originalName: record.originalName,
          },
        },
        tx,
      );

      return { success: true };
    });
  }

  async getDownloadStream(id: string, user: AuthUser) {
    const record = await this.prisma.mediaFile.findUnique({
      where: { id },
    });

    if (!record || record.deletedAt) {
      throw new NotFoundException("Media file not found");
    }

    // Tenant Isolation
    if (record.tenantId !== user.tenantId) {
      throw new ForbiddenException(
        "Access denied to cross-tenant media resource.",
      );
    }

    const stream = await this.storageProvider.getStream(record.storagePath);

    // Track download in audit log
    await this.transactionHelper.run(async (tx) => {
      await this.auditService.log(
        {
          action: "MEDIA_DOWNLOADED",
          entity: "MediaFile",
          entityId: record.id,
          newValues: {
            downloadedId: record.id,
            originalName: record.originalName,
          },
        },
        tx,
      );
    });

    return {
      stream,
      originalName: record.originalName,
      mimeType: record.mimeType,
      size: record.size,
    };
  }
}
