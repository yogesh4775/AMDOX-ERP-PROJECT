import { Module } from "@nestjs/common";
import { PrismaModule } from "@amdox/database";
import { AuditModule } from "../../common/audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { HRMService } from "./hrm.service";
import { HRMController } from "./hrm.controller";
import { TransactionHelper } from "../../common/transactions/transaction.helper";

@Module({
  imports: [PrismaModule, AuditModule, NotificationsModule],
  controllers: [HRMController],
  providers: [HRMService, TransactionHelper],
  exports: [HRMService],
})
export class HRMModule {}
