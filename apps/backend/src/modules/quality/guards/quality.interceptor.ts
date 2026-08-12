import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { QualityService } from "../services/quality.service";
import { PrismaService } from "@amdox/database";

@Injectable()
export class QualityInterceptor implements NestInterceptor {
  constructor(
    private readonly qualityService: QualityService,
    private readonly prisma: PrismaService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const { method, url } = req;
    const user = req.user;

    // 1. Block Work Order completion if there are any FAILED, PENDING, or IN_PROGRESS inspection lots
    if (
      url.includes("/api/manufacturing/work-orders/") &&
      url.endsWith("/complete") &&
      method === "POST"
    ) {
      const woId = req.params.id;
      const blockingLot = await this.prisma.inspectionLot.findFirst({
        where: {
          workOrderId: woId,
          status: { in: ["PENDING", "IN_PROGRESS", "FAILED"] },
          deletedAt: null,
        },
      });

      if (blockingLot) {
        throw new BadRequestException(
          `Cannot complete Work Order: pending or failed quality inspection exists (Lot: ${blockingLot.code}, Status: ${blockingLot.status}).`,
        );
      }
    }

    return next.handle().pipe(
      tap(async () => {
        try {
          if (!user) return;

          // 2. Intercept Purchase Receipt (receive)
          if (
            url.includes("/api/purchase/orders/") &&
            url.endsWith("/receive") &&
            method === "PATCH"
          ) {
            const poId = req.params.id;
            await this.qualityService.handlePurchaseReceiptEvent(poId, user);
          }

          // 3. Intercept Work Order Start
          if (
            url.includes("/api/manufacturing/work-orders/") &&
            url.endsWith("/start") &&
            method === "POST"
          ) {
            const woId = req.params.id;
            await this.qualityService.handleWorkOrderStartEvent(woId, user);
          }

          // 4. Intercept Work Order Complete (to auto-create Finished Goods inspection lot if passed preceding checks)
          if (
            url.includes("/api/manufacturing/work-orders/") &&
            url.endsWith("/complete") &&
            method === "POST"
          ) {
            const woId = req.params.id;
            await this.qualityService.handleWorkOrderCompleteEvent(woId, user);
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("QualityInterceptor post-processing error:", err);
        }
      }),
    );
  }
}
