import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { AuditService } from "../../../common/audit/audit.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { NotificationType } from "../../notifications/dto/query-notification.dto";
import { UpdateExchangeRateDto } from "../dto/update-exchange-rate.dto";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";

@Injectable()
export class ExchangeRateService {
  private rateCache = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async updateExchangeRate(
    tenantId: string,
    dto: UpdateExchangeRateDto,
    user: AuthUser,
  ) {
    const rateDate = new Date(dto.rateDate);
    rateDate.setHours(0, 0, 0, 0);

    const exchangeRate = await this.prisma.exchangeRate.upsert({
      where: {
        tenantId_fromCurrency_toCurrency_rateDate: {
          tenantId,
          fromCurrency: dto.fromCurrency.toUpperCase(),
          toCurrency: dto.toCurrency.toUpperCase(),
          rateDate,
        },
      },
      create: {
        tenantId,
        fromCurrency: dto.fromCurrency.toUpperCase(),
        toCurrency: dto.toCurrency.toUpperCase(),
        rate: dto.rate,
        rateDate,
      },
      update: {
        rate: dto.rate,
        version: { increment: 1 },
      },
    });

    // Invalidate local in-memory cache
    const cacheKey = `${tenantId}:${dto.fromCurrency.toUpperCase()}:${dto.toCurrency.toUpperCase()}:${rateDate.toISOString().split("T")[0]}`;
    this.rateCache.set(cacheKey, dto.rate);

    await this.auditService.log({
      action: "EXCHANGE_RATE_UPDATED",
      entity: "ExchangeRate",
      entityId: exchangeRate.id,
      newValues: {
        fromCurrency: dto.fromCurrency,
        toCurrency: dto.toCurrency,
        rate: dto.rate,
        rateDate,
      },
      userId: user.id,
      tenantId,
    });

    return exchangeRate;
  }

  async getExchangeRate(
    tenantId: string,
    fromCurrency: string,
    toCurrency: string,
    date: Date,
    userForNotification?: AuthUser,
  ): Promise<number> {
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();

    if (from === to) {
      return 1.0;
    }

    const rateDate = new Date(date);
    rateDate.setHours(0, 0, 0, 0);

    const dateStr = rateDate.toISOString().split("T")[0];
    const cacheKey = `${tenantId}:${from}:${to}:${dateStr}`;

    if (this.rateCache.has(cacheKey)) {
      return this.rateCache.get(cacheKey)!;
    }

    // Try to find exact match
    let record = await this.prisma.exchangeRate.findFirst({
      where: {
        tenantId,
        fromCurrency: from,
        toCurrency: to,
        rateDate,
      },
    });

    // Fallback: search for most recent rate on or before target date
    if (!record) {
      record = await this.prisma.exchangeRate.findFirst({
        where: {
          tenantId,
          fromCurrency: from,
          toCurrency: to,
          rateDate: { lte: rateDate },
        },
        orderBy: { rateDate: "desc" },
      });
    }

    // Reverse fallback: if EUR->USD is defined, calculate USD->EUR as 1 / rate
    if (!record) {
      const inverseRecord = await this.prisma.exchangeRate.findFirst({
        where: {
          tenantId,
          fromCurrency: to,
          toCurrency: from,
          rateDate: { lte: rateDate },
        },
        orderBy: { rateDate: "desc" },
      });
      if (inverseRecord) {
        const rate = 1.0 / Number(inverseRecord.rate);
        this.rateCache.set(cacheKey, rate);
        return rate;
      }
    }

    if (!record) {
      // Trigger notification for missing rate
      if (userForNotification) {
        await this.notificationsService.createInternal({
          userId: userForNotification.id,
          tenantId,
          title: "Missing Exchange Rate Configured",
          message: `Exchange rate from ${from} to ${to} is missing for date ${dateStr}.`,
          type: NotificationType.WARNING,
        });
      }
      throw new NotFoundException(
        `Exchange rate from ${from} to ${to} for date ${dateStr} not found.`,
      );
    }

    const rate = Number(record.rate);
    this.rateCache.set(cacheKey, rate);
    return rate;
  }

  async convertAmount(
    tenantId: string,
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    date: Date,
    userForNotification?: AuthUser,
  ): Promise<number> {
    const rate = await this.getExchangeRate(
      tenantId,
      fromCurrency,
      toCurrency,
      date,
      userForNotification,
    );
    return amount * rate;
  }
}
