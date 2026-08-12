import { Module } from "@nestjs/common";
import { PrismaModule } from "@amdox/database";
import { AuditModule } from "../../common/audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { BudgetingService } from "./budgeting.service";
import { BudgetingController } from "./budgeting.controller";
import { TransactionHelper } from "../../common/transactions/transaction.helper";

@Module({
  imports: [PrismaModule, AuditModule, NotificationsModule],
  controllers: [BudgetingController],
  providers: [BudgetingService, TransactionHelper],
  exports: [BudgetingService],
})
export class BudgetingModule {}
