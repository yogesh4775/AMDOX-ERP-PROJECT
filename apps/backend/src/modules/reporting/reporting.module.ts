import { Module } from "@nestjs/common";
import { ReportingService } from "./reporting.service";
import { ReportingController } from "./reporting.controller";
import { REPORT_EXPORTERS } from "./exporters/report-exporter.interface";
import { CsvReportExporter } from "./exporters/csv-report-exporter";
import { MediaModule } from "../media/media.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { AuthModule } from "../auth/auth.module";
import { TransactionHelper } from "../../common/transactions/transaction.helper";

@Module({
  imports: [AuthModule, MediaModule, NotificationsModule],
  controllers: [ReportingController],
  providers: [
    ReportingService,
    TransactionHelper,
    CsvReportExporter,
    {
      provide: REPORT_EXPORTERS,
      useFactory: (csvExporter: CsvReportExporter) => [csvExporter],
      inject: [CsvReportExporter],
    },
  ],
  exports: [ReportingService],
})
export class ReportingModule {}
