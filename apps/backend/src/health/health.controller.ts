import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "@amdox/database";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    let dbStatus = "down";
    let latency = -1;

    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      latency = Date.now() - start;
      dbStatus = "healthy";
    } catch {
      dbStatus = "unhealthy";
    }

    const response = {
      application: "up",
      database: {
        status: dbStatus,
        latencyMs: latency,
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV ?? "development",
      version: "1.0.0",
      prismaClientVersion: "6.19.3",
    };

    if (dbStatus !== "healthy") {
      throw new ServiceUnavailableException(response);
    }

    return response;
  }
}
