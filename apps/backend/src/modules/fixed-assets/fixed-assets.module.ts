import { Module } from "@nestjs/common";
import { FixedAssetsService } from "./fixed-assets.service";
import { FixedAssetsController } from "./fixed-assets.controller";
import { AuditModule } from "../../common/audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { AccountingModule } from "../accounting/accounting.module";
import { TransactionHelper } from "../../common/transactions/transaction.helper";

@Module({
  imports: [AuthModule, AuditModule, NotificationsModule, AccountingModule],
  controllers: [FixedAssetsController],
  providers: [FixedAssetsService, TransactionHelper],
  exports: [FixedAssetsService],
})
export class FixedAssetsModule {}
