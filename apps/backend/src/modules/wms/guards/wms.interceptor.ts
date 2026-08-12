import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { WmsService } from "../services/wms.service";
import { PrismaService } from "@amdox/database";

@Injectable()
export class WmsInterceptor implements NestInterceptor {
  constructor(
    private readonly wmsService: WmsService,
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

    return next.handle().pipe(
      tap(async () => {
        try {
          if (!user) return;

          // 1. Intercept Purchase Order Receive
          if (
            url.includes("/api/purchase/orders/") &&
            url.endsWith("/receive") &&
            method === "PATCH"
          ) {
            const poId = req.params.id;
            await this.prisma.$transaction(async (tx) => {
              await this.wmsService.handlePurchaseReceiptEvent(poId, user, tx);
            });
          }

          // 2. Intercept Work Order Start
          if (
            url.includes("/api/manufacturing/work-orders/") &&
            url.endsWith("/start") &&
            method === "POST"
          ) {
            const woId = req.params.id;
            await this.prisma.$transaction(async (tx) => {
              await this.wmsService.handleWorkOrderStartEvent(woId, user, tx);
            });
          }

          // 3. Intercept Work Order Complete
          if (
            url.includes("/api/manufacturing/work-orders/") &&
            url.endsWith("/complete") &&
            method === "POST"
          ) {
            const woId = req.params.id;
            await this.prisma.$transaction(async (tx) => {
              await this.wmsService.handleWorkOrderCompleteEvent(
                woId,
                user,
                tx,
              );
            });
          }

          // 4. Intercept Sales Order Ship
          if (
            url.includes("/api/sales/orders/") &&
            url.endsWith("/ship") &&
            method === "PATCH"
          ) {
            const soId = req.params.id;
            await this.prisma.$transaction(async (tx) => {
              await this.wmsService.handleSalesOrderShipEvent(soId, user, tx);
            });
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("WmsInterceptor post-processing error:", err);
        }
      }),
    );
  }
}
