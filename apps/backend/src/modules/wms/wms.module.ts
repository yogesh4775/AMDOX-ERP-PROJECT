import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { WmsService } from "./services/wms.service";
import { WmsController } from "./controllers/wms.controller";
import { PrismaModule } from "@amdox/database";
import { AuditModule } from "../../common/audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { InventoryModule } from "../inventory/inventory.module";
import { AccountingModule } from "../accounting/accounting.module";
import { TransactionHelper } from "../../common/transactions/transaction.helper";
import { WmsInterceptor } from "./guards/wms.interceptor";

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    NotificationsModule,
    InventoryModule,
    AccountingModule,
  ],
  controllers: [WmsController],
  providers: [
    WmsService,
    TransactionHelper,
    {
      provide: APP_INTERCEPTOR,
      useClass: WmsInterceptor,
    },
  ],
  exports: [WmsService],
})
export class WmsModule {}
