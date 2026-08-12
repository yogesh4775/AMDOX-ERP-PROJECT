import { Module } from "@nestjs/common";
import { PrismaModule } from "@amdox/database";
import { AuditModule } from "../../common/audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { LeaveModule } from "../leave/leave.module";
import { AccountingModule } from "../accounting/accounting.module";
import { PayrollService } from "./payroll.service";
import { PayrollController } from "./payroll.controller";
import { TransactionHelper } from "../../common/transactions/transaction.helper";

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    NotificationsModule,
    LeaveModule,
    AccountingModule,
  ],
  controllers: [PayrollController],
  providers: [PayrollService, TransactionHelper],
  exports: [PayrollService],
})
export class PayrollModule {}
