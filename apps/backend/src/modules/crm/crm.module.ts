import { Module } from "@nestjs/common";
import { PrismaModule } from "@amdox/database";
import { AuditModule } from "../../common/audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { CRMService } from "./crm.service";
import { CRMController } from "./crm.controller";
import { TransactionHelper } from "../../common/transactions/transaction.helper";

@Module({
  imports: [PrismaModule, AuditModule, NotificationsModule],
  controllers: [CRMController],
  providers: [CRMService, TransactionHelper],
  exports: [CRMService],
})
export class CRMModule {}
