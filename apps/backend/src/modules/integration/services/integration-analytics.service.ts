import { Injectable } from "@nestjs/common";
import { PrismaService } from "@amdox/database";

@Injectable()
export class IntegrationAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async logApiRequest(
    tenantId: string,
    apiKeyId: string | null,
    method: string,
    path: string,
    statusCode: number,
    responseTimeMs: number,
    ipAddress?: string,
  ) {
    return this.prisma.integrationApiLog.create({
      data: {
        tenantId,
        apiKeyId,
        method,
        path,
        statusCode,
        responseTimeMs,
        ipAddress: ipAddress || null,
      },
    });
  }

  async getAnalytics(tenantId: string) {
    const logs = await this.prisma.integrationApiLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });

    const totalRequests = logs.length;
    const errors = logs.filter((l) => l.statusCode >= 400).length;
    const avgResponseTime =
      totalRequests > 0
        ? logs.reduce((acc, curr) => acc + curr.responseTimeMs, 0) /
          totalRequests
        : 0;

    return {
      totalRequests,
      errors,
      avgResponseTimeMs: Math.round(avgResponseTime),
      recentLogs: logs.slice(0, 50),
    };
  }
}
