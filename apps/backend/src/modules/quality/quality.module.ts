import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { QualityController } from "./controllers/quality.controller";
import { QualityService } from "./services/quality.service";
import { QualityInterceptor } from "./guards/quality.interceptor";
import { PrismaModule } from "@amdox/database";
import { AuditModule } from "../../common/audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { InventoryModule } from "../inventory/inventory.module";
import { TransactionHelper } from "../../common/transactions/transaction.helper";

@Module({
  imports: [PrismaModule, AuditModule, NotificationsModule, InventoryModule],
  controllers: [QualityController],
  providers: [
    QualityService,
    TransactionHelper,
    {
      provide: APP_INTERCEPTOR,
      useClass: QualityInterceptor,
    },
  ],
  exports: [QualityService],
})
export class QualityModule {}
