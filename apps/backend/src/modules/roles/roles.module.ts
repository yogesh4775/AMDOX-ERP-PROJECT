import { Module } from "@nestjs/common";
import { RolesService } from "./roles.service";
import { RolesController } from "./roles.controller";
import { AuthModule } from "../auth/auth.module";
import { TransactionHelper } from "../../common/transactions/transaction.helper";

@Module({
  imports: [AuthModule],
  controllers: [RolesController],
  providers: [RolesService, TransactionHelper],
  exports: [RolesService],
})
export class RolesModule {}
