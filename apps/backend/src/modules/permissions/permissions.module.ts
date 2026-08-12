import { Module } from "@nestjs/common";
import { PermissionsService } from "./permissions.service";
import { PermissionsController } from "./permissions.controller";
import { AuthModule } from "../auth/auth.module";
import { TransactionHelper } from "../../common/transactions/transaction.helper";

@Module({
  imports: [AuthModule],
  controllers: [PermissionsController],
  providers: [PermissionsService, TransactionHelper],
  exports: [PermissionsService],
})
export class PermissionsModule {}
