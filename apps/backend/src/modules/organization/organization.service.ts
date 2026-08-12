import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { TransactionHelper } from "../../common/transactions/transaction.helper";
import { ErrorCode } from "../../common/errors/error-codes.enum";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";
import { AuditService } from "../../common/audit/audit.service";

@Injectable()
export class OrganizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionHelper: TransactionHelper,
    private readonly auditService: AuditService,
  ) {}

  async getOrganization(tenantId: string) {
    return this.transactionHelper.run(async (tx) => {
      let settings = await tx.organizationSettings.findUnique({
        where: { tenantId },
      });

      if (!settings) {
        settings = await tx.organizationSettings.create({
          data: {
            tenantId,
            companyName: "My Organization",
            version: 1,
          },
        });

        await this.auditService.log(
          {
            action: "ORGANIZATION_CREATED",
            entity: "OrganizationSettings",
            entityId: settings.id,
            newValues: {
              tenantId,
              companyName: settings.companyName,
            },
          },
          tx,
        );
      }

      return settings;
    });
  }

  async updateOrganization(
    tenantId: string,
    dto: UpdateOrganizationDto,
    _userId?: string,
  ) {
    return this.transactionHelper.run(async (tx) => {
      const settings = await tx.organizationSettings.findUnique({
        where: { tenantId },
      });

      if (!settings) {
        throw new NotFoundException({
          message: "Organization settings not found",
          error: ErrorCode.TENANT_NOT_FOUND,
        });
      }

      // Timezone validation
      if (dto.timezone) {
        const trimmedTimezone = dto.timezone.trim();
        try {
          Intl.DateTimeFormat(undefined, { timeZone: trimmedTimezone });
        } catch {
          throw new BadRequestException({
            message: "Invalid timezone name (IANA format required)",
            error: ErrorCode.VALIDATION_INVALID_INPUT,
          });
        }
      }

      // Website URL validation
      if (dto.website) {
        const trimmedUrl = dto.website.trim().toLowerCase();
        const hasProtocol =
          trimmedUrl.startsWith("http://") || trimmedUrl.startsWith("https://");
        try {
          new URL(hasProtocol ? trimmedUrl : `https://${trimmedUrl}`);
        } catch {
          throw new BadRequestException({
            message: "Invalid website URL",
            error: ErrorCode.VALIDATION_INVALID_INPUT,
          });
        }
      }

      // Normalize fields and verify changes
      let changed = false;
      const updateData: Record<string, unknown> = {};
      const oldValues: Record<string, unknown> = {};
      const newValues: Record<string, unknown> = {};

      const fieldsToCheck = [
        "companyName",
        "legalName",
        "logoUrl",
        "website",
        "email",
        "phone",
        "taxNumber",
        "currency",
        "timezone",
        "fiscalYearStart",
        "address",
        "city",
        "state",
        "postalCode",
        "country",
      ];

      for (const field of fieldsToCheck) {
        const value = dto[field as keyof UpdateOrganizationDto];
        if (value !== undefined) {
          let normalizedValue: unknown = value;
          if (typeof value === "string") {
            normalizedValue = value.trim();
            if (field === "email") {
              normalizedValue = (normalizedValue as string).toLowerCase();
            }
            if (field === "website") {
              normalizedValue = (normalizedValue as string).toLowerCase();
            }
            if (field === "currency") {
              normalizedValue = (normalizedValue as string).toUpperCase();
            }
          }

          const existingValue = settings[field as keyof typeof settings];
          if (existingValue !== normalizedValue) {
            changed = true;
            updateData[field] = normalizedValue;
            oldValues[field] = existingValue;
            newValues[field] = normalizedValue;
          }
        }
      }

      if (!changed) {
        return settings;
      }

      const result = await tx.organizationSettings.updateMany({
        where: {
          tenantId,
          version: dto.version,
        },
        data: {
          ...updateData,
          version: { increment: 1 },
        },
      });

      if (result.count === 0) {
        throw new ConflictException({
          message:
            "Concurrent modification error: Organization version mismatch",
          error: ErrorCode.DATABASE_CONFLICT,
        });
      }

      await this.auditService.log(
        {
          action: "ORGANIZATION_UPDATED",
          entity: "OrganizationSettings",
          entityId: settings.id,
          oldValues,
          newValues,
        },
        tx,
      );

      const updated = await tx.organizationSettings.findUnique({
        where: { tenantId },
      });

      if (!updated) {
        throw new NotFoundException({
          message: "Organization settings not found after update",
          error: ErrorCode.TENANT_NOT_FOUND,
        });
      }

      return updated;
    });
  }
}
