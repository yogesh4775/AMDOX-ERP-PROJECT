import { Module } from "@nestjs/common";
import { PurchaseService } from "./purchase.service";
import { PurchaseController } from "./purchase.controller";
import { TransactionHelper } from "../../common/transactions/transaction.helper";
import { AuditModule } from "../../common/audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { InventoryModule } from "../inventory/inventory.module";

import { AccountingModule } from "../accounting/accounting.module";
import { TaxModule } from "../tax/tax.module";

@Module({
  imports: [
    AuthModule,
    AuditModule,
    NotificationsModule,
    InventoryModule,
    AccountingModule,
    TaxModule,
  ],
  controllers: [PurchaseController],
  providers: [PurchaseService, TransactionHelper],
  exports: [PurchaseService],
})
export class PurchaseModule {}
