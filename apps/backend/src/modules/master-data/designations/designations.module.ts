import { Module } from "@nestjs/common";
import { DesignationsService } from "./designations.service";
import { DesignationsController } from "./designations.controller";
import { TransactionHelper } from "../../../common/transactions/transaction.helper";
import { AuditModule } from "../../../common/audit/audit.module";
import { AuthModule } from "../../auth/auth.module";

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [DesignationsController],
  providers: [DesignationsService, TransactionHelper],
  exports: [DesignationsService],
})
export class DesignationsModule {}
