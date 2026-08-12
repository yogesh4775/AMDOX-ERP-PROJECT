import { Module } from "@nestjs/common";
import { PrismaModule } from "@amdox/database";
import { AuditModule } from "../../common/audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { WorkflowService } from "./services/workflow.service";
import { WorkflowController } from "./controllers/workflow.controller";
import { TransactionHelper } from "../../common/transactions/transaction.helper";

@Module({
  imports: [PrismaModule, AuditModule, NotificationsModule],
  controllers: [WorkflowController],
  providers: [WorkflowService, TransactionHelper],
  exports: [WorkflowService],
})
export class WorkflowModule {}
