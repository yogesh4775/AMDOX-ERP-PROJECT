import { Module } from "@nestjs/common";
import { ConsolidationController } from "./controllers/consolidation.controller";
import { CompanyService } from "./services/company.service";
import { ExchangeRateService } from "./services/exchange-rate.service";
import { InterCompanyService } from "./services/inter-company.service";
import { ConsolidationService } from "./services/consolidation.service";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { AuditService } from "../../common/audit/audit.service";

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [ConsolidationController],
  providers: [
    CompanyService,
    ExchangeRateService,
    InterCompanyService,
    ConsolidationService,
    AuditService,
  ],
  exports: [
    CompanyService,
    ExchangeRateService,
    InterCompanyService,
    ConsolidationService,
  ],
})
export class ConsolidationModule {}
