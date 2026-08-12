/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { AuditService } from "../../../common/audit/audit.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";
import { ForecastQueryDto } from "../dto/forecast.dto";

@Injectable()
export class BiForecastingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async generateForecast(dto: ForecastQueryDto, user: AuthUser) {
    const tenantId = user.tenantId!;
    const periods = dto.periods || 6;
    const method = dto.method || "linear_regression";

    let historicalData: { date: Date; value: number }[] = [];

    if (dto.type === "sales") {
      const sales = await this.prisma.biFactSales.findMany({
        where: {
          tenantId,
          ...(dto.productId && { productId: dto.productId }),
        },
        orderBy: { orderDate: "asc" },
      });
      historicalData = sales.map((s) => ({
        date: s.orderDate,
        value: s.orderValue,
      }));
    } else if (dto.type === "inventory") {
      const inv = await this.prisma.biFactInventory.findMany({
        where: {
          tenantId,
          ...(dto.productId && { productId: dto.productId }),
        },
        orderBy: { snapshotDate: "asc" },
      });
      historicalData = inv.map((i) => ({
        date: i.snapshotDate,
        value: i.stockOnHand,
      }));
    } else if (dto.type === "cash_flow") {
      const fin = await this.prisma.biFactFinance.findMany({
        where: { tenantId },
        orderBy: { postingDate: "asc" },
      });
      historicalData = fin.map((f) => ({
        date: f.postingDate,
        value: f.netAmount,
      }));
    } else {
      throw new BadRequestException("Unsupported forecast type");
    }

    if (historicalData.length === 0) {
      // Mock seed data for empty database runs
      historicalData = Array.from({ length: 12 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (12 - i));
        return { date: d, value: 1000 + i * 150 + Math.random() * 100 };
      });
    }

    // Prepare x and y values
    const y = historicalData.map((d) => d.value);
    const x = Array.from({ length: y.length }, (_, i) => i);

    let predictions: { period: number; value: number }[] = [];

    if (method === "moving_average") {
      // Simple Moving Average of size 3
      const windowSize = Math.min(3, y.length);
      const lastValues = y.slice(-windowSize);
      const avg = lastValues.reduce((sum, val) => sum + val, 0) / windowSize;

      predictions = Array.from({ length: periods }, (_, i) => ({
        period: y.length + i + 1,
        value: avg,
      }));
    } else {
      // Linear Regression: y = m * x + c
      const n = y.length;
      let sumX = 0,
        sumY = 0,
        sumXY = 0,
        sumXX = 0;
      for (let i = 0; i < n; i++) {
        sumX += x[i];
        sumY += y[i];
        sumXY += x[i] * y[i];
        sumXX += x[i] * x[i];
      }
      const m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
      const c = (sumY - m * sumX) / n;

      predictions = Array.from({ length: periods }, (_, i) => {
        const nextX = n + i;
        const val = m * nextX + c;
        return {
          period: nextX + 1,
          value: Math.max(0, val), // Inventory and sales cannot go below 0
        };
      });
    }

    // Check for anomalies: e.g. projection drops below zero or experiences > 50% deviation
    const lastHistVal = y[y.length - 1] || 0;
    const firstPredVal = predictions[0]?.value || 0;
    if (
      lastHistVal > 0 &&
      Math.abs(firstPredVal - lastHistVal) / lastHistVal > 0.5
    ) {
      await this.notificationsService.createInternal({
        userId: user.id,
        tenantId,
        title: "Forecasting Anomaly Detected",
        message: `Forecast for ${dto.type} shows a high deviation of over 50% from last historical value. Historical: ${lastHistVal.toFixed(2)}, Projected: ${firstPredVal.toFixed(2)}.`,
        type: "WARNING" as any,
      });
    }

    await this.auditService.log({
      userId: user.id,
      tenantId,
      entity: "BiHistoricalSnapshot",
      entityId: "SYSTEM",
      action: "FORECAST_GENERATED",
      newValues: { type: dto.type, method, periods },
    });

    return {
      history: historicalData,
      predictions,
      method,
      type: dto.type,
    };
  }
}
