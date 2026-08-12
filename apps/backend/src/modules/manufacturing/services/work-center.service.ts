import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { AuditService } from "../../../common/audit/audit.service";
import { CreateWorkCenterDto } from "../dto/create-work-center.dto";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";
import { WorkCenterStatus } from "@amdox/database/generated";

@Injectable()
export class WorkCenterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateWorkCenterDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    const existing = await this.prisma.workCenter.findFirst({
      where: { tenantId, code: dto.code, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException(
        `Work Center with code ${dto.code} already exists.`,
      );
    }

    const wc = await this.prisma.workCenter.create({
      data: {
        tenantId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        overheadRate: dto.overheadRate,
        capacity: dto.capacity,
        assetId: dto.assetId,
        status: dto.status || WorkCenterStatus.ACTIVE,
      },
    });

    await this.auditService.log({
      action: "WORK_CENTER_CREATED",
      entity: "WorkCenter",
      entityId: wc.id,
      newValues: wc as unknown as Record<string, unknown>,
    });

    return wc;
  }

  async findAll(user: AuthUser) {
    return this.prisma.workCenter.findMany({
      where: { tenantId: user.tenantId!, deletedAt: null },
    });
  }

  async findOne(id: string, user: AuthUser) {
    const wc = await this.prisma.workCenter.findFirst({
      where: { id, tenantId: user.tenantId!, deletedAt: null },
    });
    if (!wc) {
      throw new NotFoundException(`Work Center not found.`);
    }
    return wc;
  }

  async update(
    id: string,
    dto: Partial<CreateWorkCenterDto> & { expectedVersion?: number },
    user: AuthUser,
  ) {
    const tenantId = user.tenantId!;
    const wc = await this.findOne(id, user);

    if (
      dto.expectedVersion !== undefined &&
      wc.version !== dto.expectedVersion
    ) {
      throw new ConflictException(
        "Optimistic lock conflict. Version mismatch.",
      );
    }

    if (dto.code && dto.code !== wc.code) {
      const existing = await this.prisma.workCenter.findFirst({
        where: { tenantId, code: dto.code, deletedAt: null },
      });
      if (existing) {
        throw new ConflictException(
          `Work Center with code ${dto.code} already exists.`,
        );
      }
    }

    const updated = await this.prisma.workCenter.update({
      where: { id },
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        overheadRate: dto.overheadRate,
        capacity: dto.capacity,
        assetId: dto.assetId,
        status: dto.status,
        version: { increment: 1 },
      },
    });

    await this.auditService.log({
      action: "WORK_CENTER_UPDATED",
      entity: "WorkCenter",
      entityId: id,
      newValues: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }

  async remove(id: string, user: AuthUser) {
    await this.findOne(id, user);

    const deleted = await this.prisma.workCenter.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        version: { increment: 1 },
      },
    });

    await this.auditService.log({
      action: "WORK_CENTER_DELETED",
      entity: "WorkCenter",
      entityId: id,
      newValues: { deletedAt: deleted.deletedAt } as unknown as Record<
        string,
        unknown
      >,
    });

    return { success: true };
  }
}
