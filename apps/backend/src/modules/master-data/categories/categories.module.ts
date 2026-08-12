import { Module } from "@nestjs/common";
import { CategoriesService } from "./categories.service";
import { CategoriesController } from "./categories.controller";
import { TransactionHelper } from "../../../common/transactions/transaction.helper";
import { AuditModule } from "../../../common/audit/audit.module";
import { AuthModule } from "../../auth/auth.module";

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [CategoriesController],
  providers: [CategoriesService, TransactionHelper],
  exports: [CategoriesService],
})
export class CategoriesModule {}
