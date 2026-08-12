import { Module } from "@nestjs/common";
import { AccountingService } from "./accounting.service";
import { AccountingController } from "./accounting.controller";
import { AuditModule } from "../../common/audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";

import { TransactionHelper } from "../../common/transactions/transaction.helper";

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [AccountingController],
  providers: [AccountingService, TransactionHelper],
  exports: [AccountingService],
})
export class AccountingModule {}
