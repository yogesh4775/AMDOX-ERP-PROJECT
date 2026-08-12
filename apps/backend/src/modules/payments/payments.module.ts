import { Module } from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { PaymentsController } from "./payments.controller";
import { TransactionHelper } from "../../common/transactions/transaction.helper";
import { AuditModule } from "../../common/audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";

import { AccountingModule } from "../accounting/accounting.module";

@Module({
  imports: [AuthModule, AuditModule, NotificationsModule, AccountingModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, TransactionHelper],
  exports: [PaymentsService],
})
export class PaymentsModule {}
