import { Controller, Get, Query, UseGuards, Req } from "@nestjs/common";
import { StockService } from "./stock.service";
import { QueryStockDto } from "./dto/query-stock.dto";
import { QueryStockMovementDto } from "./dto/query-movement.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../common/constants/permissions.constants";
import { AuthUser } from "../auth/interfaces/auth-user.interface";

@Controller("inventory/stock")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get()
  @Permissions(PermissionsList.STOCK_READ)
  async findAllStocks(
    @Query() query: QueryStockDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.stockService.findAllStocks(query, req.user);
  }

  @Get("movements")
  @Permissions(PermissionsList.STOCK_MOVE_READ)
  async findAllMovements(
    @Query() query: QueryStockMovementDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.stockService.findAllMovements(query, req.user);
  }
}
