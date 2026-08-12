import { Module } from "@nestjs/common";
import { PrismaModule } from "@amdox/database";
import { AuditModule } from "../../common/audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { LeaveService } from "./leave.service";
import { LeaveController } from "./leave.controller";
import { TransactionHelper } from "../../common/transactions/transaction.helper";

@Module({
  imports: [PrismaModule, AuditModule, NotificationsModule],
  controllers: [LeaveController],
  providers: [LeaveService, TransactionHelper],
  exports: [LeaveService],
})
export class LeaveModule {}
