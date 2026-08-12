import { Module } from "@nestjs/common";
import { PrismaModule } from "@amdox/database";
import { AuditModule } from "../../common/audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { AccountingModule } from "../accounting/accounting.module";
import { ExpenseService } from "./expense.service";
import { ExpenseController } from "./expense.controller";
import { TransactionHelper } from "../../common/transactions/transaction.helper";

@Module({
  imports: [PrismaModule, AuditModule, NotificationsModule, AccountingModule],
  controllers: [ExpenseController],
  providers: [ExpenseService, TransactionHelper],
  exports: [ExpenseService],
})
export class ExpenseModule {}
