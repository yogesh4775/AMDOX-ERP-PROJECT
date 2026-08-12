import { Module } from "@nestjs/common";
import { WorkCenterService } from "./services/work-center.service";
import { BOMService } from "./services/bom.service";
import { RoutingService } from "./services/routing.service";
import { WorkOrderService } from "./services/work-order.service";
import { MRPService } from "./services/mrp.service";
import { WorkCenterController } from "./controllers/work-center.controller";
import { BOMController } from "./controllers/bom.controller";
import { RoutingController } from "./controllers/routing.controller";
import { WorkOrderController } from "./controllers/work-order.controller";
import { MRPController } from "./controllers/mrp.controller";
import { AuthModule } from "../auth/auth.module";
import { AuditModule } from "../../common/audit/audit.module";
import { InventoryModule } from "../inventory/inventory.module";
import { AccountingModule } from "../accounting/accounting.module";
import { PurchaseModule } from "../purchase/purchase.module";

@Module({
  imports: [
    AuthModule,
    AuditModule,
    InventoryModule,
    AccountingModule,
    PurchaseModule,
  ],
  controllers: [
    WorkCenterController,
    BOMController,
    RoutingController,
    WorkOrderController,
    MRPController,
  ],
  providers: [
    WorkCenterService,
    BOMService,
    RoutingService,
    WorkOrderService,
    MRPService,
  ],
  exports: [
    WorkCenterService,
    BOMService,
    RoutingService,
    WorkOrderService,
    MRPService,
  ],
})
export class ManufacturingModule {}
