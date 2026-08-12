import { Module } from "@nestjs/common";
import { FinancialReportingService } from "./financial-reporting.service";
import { FinancialReportingController } from "./financial-reporting.controller";
import { AuditModule } from "../../common/audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [FinancialReportingController],
  providers: [FinancialReportingService],
  exports: [FinancialReportingService],
})
export class FinancialReportingModule {}
