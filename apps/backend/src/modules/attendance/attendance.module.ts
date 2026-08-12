import { Module } from "@nestjs/common";
import { PrismaModule } from "@amdox/database";
import { AuditModule } from "../../common/audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { AttendanceService } from "./attendance.service";
import { AttendanceController } from "./attendance.controller";
import { TransactionHelper } from "../../common/transactions/transaction.helper";

@Module({
  imports: [PrismaModule, AuditModule, NotificationsModule],
  controllers: [AttendanceController],
  providers: [AttendanceService, TransactionHelper],
  exports: [AttendanceService],
})
export class AttendanceModule {}
