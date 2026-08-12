import { Module } from "@nestjs/common";
import { CustomersService } from "./customers.service";
import { CustomersController } from "./customers.controller";
import { SalesService } from "./sales.service";
import { SalesController } from "./sales.controller";
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
  controllers: [CustomersController, SalesController],
  providers: [CustomersService, SalesService, TransactionHelper],
  exports: [CustomersService, SalesService],
})
export class SalesModule {}
