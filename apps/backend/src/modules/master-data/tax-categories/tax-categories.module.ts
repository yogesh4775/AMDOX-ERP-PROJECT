import { Module } from "@nestjs/common";
import { TaxCategoriesService } from "./tax-categories.service";
import { TaxCategoriesController } from "./tax-categories.controller";
import { TransactionHelper } from "../../../common/transactions/transaction.helper";
import { AuditModule } from "../../../common/audit/audit.module";
import { AuthModule } from "../../auth/auth.module";

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [TaxCategoriesController],
  providers: [TaxCategoriesService, TransactionHelper],
  exports: [TaxCategoriesService],
})
export class TaxCategoriesModule {}
