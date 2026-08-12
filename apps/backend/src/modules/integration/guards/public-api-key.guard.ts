import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { IntegrationKeyService } from "../services/integration-key.service";
import { PrismaService } from "@amdox/database";

@Injectable()
export class PublicApiKeyGuard implements CanActivate {
  private static requestTimestamps = new Map<string, number[]>();

  constructor(
    private readonly keyService: IntegrationKeyService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const keyString = request.headers["x-api-key"];

    if (!keyString) {
      throw new UnauthorizedException("Missing x-api-key header.");
    }

    const key = await this.keyService.validateKey(keyString);
    if (!key) {
      throw new UnauthorizedException("Invalid or expired API key.");
    }

    // 1. Enforce Daily Quota Limit
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayCount = await this.prisma.integrationApiLog.count({
      where: { apiKeyId: key.id, createdAt: { gte: startOfToday } },
    });
    if (todayCount >= key.dailyQuotaLimit) {
      throw new HttpException(
        "Daily quota limit exceeded.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 2. Enforce Rate Limiting (TPS) - Sliding Window In-Memory
    const now = Date.now();
    let timestamps = PublicApiKeyGuard.requestTimestamps.get(key.id) || [];
    timestamps = timestamps.filter((t) => now - t < 1000);

    if (timestamps.length >= key.rateLimitTps) {
      throw new HttpException(
        "Rate limit TPS exceeded.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    timestamps.push(now);
    PublicApiKeyGuard.requestTimestamps.set(key.id, timestamps);

    // Attach key contexts to request
    request.apiKey = key;
    request.user = {
      id: "api_key_user",
      tenantId: key.tenantId,
      roles: ["Partner"],
    };

    return true;
  }
}
