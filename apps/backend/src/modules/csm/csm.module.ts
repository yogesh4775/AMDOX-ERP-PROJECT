import { Module } from "@nestjs/common";
import { PrismaModule } from "@amdox/database";
import { AuditModule } from "../../common/audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { WmsModule } from "../wms/wms.module";
import { QualityModule } from "../quality/quality.module";
import { WorkflowModule } from "../workflow/workflow.module";
import { AccountingModule } from "../accounting/accounting.module";
import { TmsModule } from "../tms/tms.module";
import { CsmController } from "./controllers/csm.controller";
import { CsmService } from "./services/csm.service";

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    NotificationsModule,
    WmsModule,
    QualityModule,
    WorkflowModule,
    AccountingModule,
    TmsModule,
  ],
  controllers: [CsmController],
  providers: [CsmService],
  exports: [CsmService],
})
export class CsmModule {}
