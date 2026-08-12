import { Module } from "@nestjs/common";
import { PrismaModule } from "@amdox/database";
import { AuditModule } from "../../common/audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PmsService } from "./pms.service";
import { PmsController } from "./pms.controller";
import { TransactionHelper } from "../../common/transactions/transaction.helper";

@Module({
  imports: [PrismaModule, AuditModule, NotificationsModule],
  controllers: [PmsController],
  providers: [PmsService, TransactionHelper],
  exports: [PmsService],
})
export class PmsModule {}
