import { Injectable } from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { requestContextStorage } from "./request-context-storage";
import { CreateAuditLogDto } from "./audit.types";
import { PrismaTx } from "../transactions/transaction.helper";
import { Prisma } from "@amdox/database/generated";

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  private maskSensitiveData(
    data: Record<string, unknown> | null,
  ): Record<string, unknown> | null {
    if (!data) return data;
    const cloned = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
    const sensitiveKeys = [
      "password",
      "passwordHash",
      "password_hash",
      "accessToken",
      "access_token",
      "refreshToken",
      "refresh_token",
      "authorization",
      "cookie",
      "secret",
      "jwt",
      "otp",
      "apiKey",
      "api_key",
      "clientSecret",
      "client_secret",
    ];

    const recurse = (obj: unknown) => {
      if (typeof obj !== "object" || obj === null) return;
      const objRecord = obj as Record<string, unknown>;
      for (const key in objRecord) {
        const val = objRecord[key];
        if (
          sensitiveKeys.some((sk) =>
            key.toLowerCase().includes(sk.toLowerCase()),
          )
        ) {
          objRecord[key] = "[MASKED]";
        } else if (typeof val === "object") {
          recurse(val);
        }
      }
    };

    recurse(cloned);
    return cloned;
  }

  async log(dto: CreateAuditLogDto, tx?: PrismaTx) {
    const client = tx || this.prisma;
    const context = requestContextStorage.getStore();

    const maskedOld = dto.oldValues
      ? (this.maskSensitiveData(dto.oldValues) as Prisma.InputJsonValue)
      : null;
    const maskedNew = dto.newValues
      ? (this.maskSensitiveData(dto.newValues) as Prisma.InputJsonValue)
      : null;

    await client.auditLog.create({
      data: {
        action: dto.action,
        entity: dto.entity,
        entityId: dto.entityId || null,
        oldValues: (maskedOld ?? undefined) as Prisma.InputJsonValue,
        newValues: (maskedNew ?? undefined) as Prisma.InputJsonValue,
        requestId: dto.requestId || context?.requestId || null,
        userId: dto.userId || context?.userId || null,
        tenantId: dto.tenantId || context?.tenantId || null,
        ipAddress: dto.ipAddress || context?.ip || null,
        userAgent: dto.userAgent || context?.userAgent || null,
      },
    });
  }

  async logCreate(
    entity: string,
    entityId: string,
    newValues: Record<string, unknown> | null,
    tx?: PrismaTx,
  ) {
    const action = `${entity.toUpperCase()}_CREATED`;
    await this.log(
      {
        action,
        entity,
        entityId,
        newValues,
      },
      tx,
    );
  }

  async logUpdate(
    entity: string,
    entityId: string,
    oldValues: Record<string, unknown> | null,
    newValues: Record<string, unknown> | null,
    tx?: PrismaTx,
  ) {
    const action = `${entity.toUpperCase()}_UPDATED`;
    await this.log(
      {
        action,
        entity,
        entityId,
        oldValues,
        newValues,
      },
      tx,
    );
  }

  async logDelete(
    entity: string,
    entityId: string,
    oldValues: Record<string, unknown> | null,
    tx?: PrismaTx,
  ) {
    const action = `${entity.toUpperCase()}_DELETED`;
    await this.log(
      {
        action,
        entity,
        entityId,
        oldValues,
      },
      tx,
    );
  }

  async logRestore(entity: string, entityId: string, tx?: PrismaTx) {
    const action = `${entity.toUpperCase()}_RESTORED`;
    await this.log(
      {
        action,
        entity,
        entityId,
      },
      tx,
    );
  }
}
