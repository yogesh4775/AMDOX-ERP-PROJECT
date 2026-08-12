import { Module } from "@nestjs/common";
import { ProductsService } from "./products.service";
import { ProductsController } from "./products.controller";
import { StockService } from "./stock.service";
import { StockController } from "./stock.controller";
import { StockTransfersService } from "./stock-transfers.service";
import { StockTransfersController } from "./stock-transfers.controller";
import { StockAdjustmentsService } from "./stock-adjustments.service";
import { StockAdjustmentsController } from "./stock-adjustments.controller";
import { TransactionHelper } from "../../common/transactions/transaction.helper";
import { AuditModule } from "../../common/audit/audit.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [
    ProductsController,
    StockController,
    StockTransfersController,
    StockAdjustmentsController,
  ],
  providers: [
    ProductsService,
    StockService,
    StockTransfersService,
    StockAdjustmentsService,
    TransactionHelper,
  ],
  exports: [
    ProductsService,
    StockService,
    StockTransfersService,
    StockAdjustmentsService,
  ],
})
export class InventoryModule {}
