import { Module } from "@nestjs/common";
import { WarehousesService } from "./warehouses.service";
import { WarehousesController } from "./warehouses.controller";
import { TransactionHelper } from "../../../common/transactions/transaction.helper";
import { AuditModule } from "../../../common/audit/audit.module";
import { AuthModule } from "../../auth/auth.module";

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [WarehousesController],
  providers: [WarehousesService, TransactionHelper],
  exports: [WarehousesService],
})
export class WarehousesModule {}
