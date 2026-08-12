import { Module } from "@nestjs/common";
import { TenantService } from "./tenant.service";
import { TenantController } from "./tenant.controller";
import { AuthModule } from "../auth/auth.module";
import { TransactionHelper } from "../../common/transactions/transaction.helper";

@Module({
  imports: [AuthModule],
  controllers: [TenantController],
  providers: [TenantService, TransactionHelper],
  exports: [TenantService],
})
export class TenantModule {}
