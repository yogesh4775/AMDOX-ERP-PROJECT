import { Module } from "@nestjs/common";
import { InvoicesService } from "./invoices.service";
import { InvoicesController } from "./invoices.controller";
import { TransactionHelper } from "../../common/transactions/transaction.helper";
import { AuditModule } from "../../common/audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";

import { AccountingModule } from "../accounting/accounting.module";
import { TaxModule } from "../tax/tax.module";

@Module({
  imports: [
    AuthModule,
    AuditModule,
    NotificationsModule,
    AccountingModule,
    TaxModule,
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService, TransactionHelper],
  exports: [InvoicesService],
})
export class InvoicesModule {}
