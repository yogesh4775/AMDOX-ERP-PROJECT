import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { BiController } from "./controllers/bi.controller";
import { BiReportController } from "./controllers/bi-report.controller";
import { BiService } from "./services/bi.service";
import { BiForecastingService } from "./services/bi-forecasting.service";
import { BiReportService } from "./services/bi-report.service";
import { BiExportService } from "./services/bi-export.service";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { AuditService } from "../../common/audit/audit.service";

@Module({
  imports: [ScheduleModule.forRoot(), AuthModule, NotificationsModule],
  controllers: [BiController, BiReportController],
  providers: [
    BiService,
    BiForecastingService,
    BiReportService,
    BiExportService,
    AuditService,
  ],
  exports: [BiService, BiForecastingService, BiReportService, BiExportService],
})
export class BiModule {}
