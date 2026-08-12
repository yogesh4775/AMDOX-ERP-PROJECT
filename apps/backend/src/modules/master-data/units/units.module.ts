import { Module } from "@nestjs/common";
import { UnitsService } from "./units.service";
import { UnitsController } from "./units.controller";
import { TransactionHelper } from "../../../common/transactions/transaction.helper";
import { AuditModule } from "../../../common/audit/audit.module";
import { AuthModule } from "../../auth/auth.module";

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [UnitsController],
  providers: [UnitsService, TransactionHelper],
  exports: [UnitsService],
})
export class UnitsModule {}
