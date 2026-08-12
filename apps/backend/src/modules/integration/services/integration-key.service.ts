import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { AuditService } from "../../../common/audit/audit.service";
import { CreateApiKeyDto } from "../dto/create-api-key.dto";
import { RotateApiKeyDto } from "../dto/rotate-api-key.dto";
import * as crypto from "crypto";

@Injectable()
export class IntegrationKeyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createKey(tenantId: string, dto: CreateApiKeyDto) {
    const rawKey = crypto.randomBytes(32).toString("hex");
    const keyPrefix = "amdox_live_";
    const fullKey = `${keyPrefix}${rawKey}`;
    const hashedKey = crypto.createHash("sha256").update(fullKey).digest("hex");

    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    const apiKey = await this.prisma.integrationApiKey.create({
      data: {
        tenantId,
        name: dto.name,
        keyPrefix,
        hashedKey,
        scopes: dto.scopes,
        expiresAt,
        rateLimitTps: dto.rateLimitTps ?? 10,
        dailyQuotaLimit: dto.dailyQuotaLimit ?? 10000,
      },
    });

    // Log API Key Created Audit Event
    await this.auditService.log({
      action: "API_KEY_CREATED",
      entity: "IntegrationApiKey",
      entityId: apiKey.id,
      newValues: { name: dto.name, keyPrefix, scopes: dto.scopes },
    });

    return {
      apiKey,
      plainTextKey: fullKey,
    };
  }

  async rotateKey(tenantId: string, id: string, dto: RotateApiKeyDto) {
    const key = await this.prisma.integrationApiKey.findFirst({
      where: { id, tenantId },
    });

    if (!key) {
      throw new NotFoundException(`API key ${id} not found.`);
    }

    if (key.version !== dto.expectedVersion) {
      throw new ConflictException(
        "Optimistic Concurrency conflict: Version mismatch.",
      );
    }

    const rawKey = crypto.randomBytes(32).toString("hex");
    const fullKey = `${key.keyPrefix}${rawKey}`;
    const hashedKey = crypto.createHash("sha256").update(fullKey).digest("hex");

    const updated = await this.prisma.integrationApiKey.update({
      where: { id },
      data: {
        hashedKey,
        version: { increment: 1 },
      },
    });

    // Log API Key Rotated Audit Event
    await this.auditService.log({
      action: "API_KEY_ROTATED",
      entity: "IntegrationApiKey",
      entityId: id,
      newValues: { name: key.name },
    });

    return {
      apiKey: updated,
      plainTextKey: fullKey,
    };
  }

  async revokeKey(tenantId: string, id: string) {
    const key = await this.prisma.integrationApiKey.findFirst({
      where: { id, tenantId },
    });

    if (!key) {
      throw new NotFoundException(`API key ${id} not found.`);
    }

    const updated = await this.prisma.integrationApiKey.update({
      where: { id },
      data: {
        isActive: false,
      },
    });

    // Log API Key Revoked Audit Event
    await this.auditService.log({
      action: "API_KEY_REVOKED",
      entity: "IntegrationApiKey",
      entityId: id,
      newValues: { name: key.name },
    });

    return updated;
  }

  async validateKey(plainTextKey: string) {
    const hashedKey = crypto
      .createHash("sha256")
      .update(plainTextKey)
      .digest("hex");
    const key = await this.prisma.integrationApiKey.findFirst({
      where: { hashedKey, isActive: true },
    });

    if (!key) {
      return null;
    }

    if (key.expiresAt && key.expiresAt < new Date()) {
      return null;
    }

    return key;
  }

  async getKeys(tenantId: string) {
    return this.prisma.integrationApiKey.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
  }
}
