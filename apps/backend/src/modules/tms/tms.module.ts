import { Module } from "@nestjs/common";
import { TmsService } from "./services/tms.service";
import { TmsController } from "./controllers/tms.controller";
import { PrismaModule } from "@amdox/database";
import { AuditModule } from "../../common/audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { InventoryModule } from "../inventory/inventory.module";
import { AccountingModule } from "../accounting/accounting.module";
import { WorkflowModule } from "../workflow/workflow.module";
import { TransactionHelper } from "../../common/transactions/transaction.helper";

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    NotificationsModule,
    InventoryModule,
    AccountingModule,
    WorkflowModule,
  ],
  controllers: [TmsController],
  providers: [TmsService, TransactionHelper],
  exports: [TmsService],
})
export class TmsModule {}
