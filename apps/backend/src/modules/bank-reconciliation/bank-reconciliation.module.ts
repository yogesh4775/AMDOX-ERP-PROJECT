import { Module } from "@nestjs/common";
import { BankReconciliationService } from "./bank-reconciliation.service";
import { BankReconciliationController } from "./bank-reconciliation.controller";
import { AuditModule } from "../../common/audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { AccountingModule } from "../accounting/accounting.module";
import { TransactionHelper } from "../../common/transactions/transaction.helper";

@Module({
  imports: [AuthModule, AuditModule, NotificationsModule, AccountingModule],
  controllers: [BankReconciliationController],
  providers: [BankReconciliationService, TransactionHelper],
  exports: [BankReconciliationService],
})
export class BankReconciliationModule {}
