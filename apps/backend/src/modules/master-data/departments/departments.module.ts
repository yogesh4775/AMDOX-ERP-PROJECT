import { Module } from "@nestjs/common";
import { DepartmentsService } from "./departments.service";
import { DepartmentsController } from "./departments.controller";
import { TransactionHelper } from "../../../common/transactions/transaction.helper";
import { AuditModule } from "../../../common/audit/audit.module";
import { AuthModule } from "../../auth/auth.module";

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [DepartmentsController],
  providers: [DepartmentsService, TransactionHelper],
  exports: [DepartmentsService],
})
export class DepartmentsModule {}
