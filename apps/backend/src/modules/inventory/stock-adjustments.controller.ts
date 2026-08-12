import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { StockAdjustmentsService } from "./stock-adjustments.service";
import { CreateStockAdjustmentDto } from "./dto/create-adjustment.dto";
import { UpdateStockAdjustmentDto } from "./dto/update-adjustment.dto";
import { QueryStockAdjustmentDto } from "./dto/query-adjustment.dto";
import { DeleteStockAdjustmentDto } from "./dto/delete-adjustment.dto";
import { ApproveStockAdjustmentDto } from "./dto/approve-adjustment.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../common/constants/permissions.constants";
import { AuthUser } from "../auth/interfaces/auth-user.interface";

@Controller("inventory/adjustments")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StockAdjustmentsController {
  constructor(
    private readonly stockAdjustmentsService: StockAdjustmentsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PermissionsList.STOCK_ADJUST_CREATE)
  async create(
    @Body() dto: CreateStockAdjustmentDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.stockAdjustmentsService.create(dto, req.user);
  }

  @Get()
  @Permissions(PermissionsList.STOCK_ADJUST_READ)
  async findAll(
    @Query() query: QueryStockAdjustmentDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.stockAdjustmentsService.findAll(query, req.user);
  }

  @Get(":id")
  @Permissions(PermissionsList.STOCK_ADJUST_READ)
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.stockAdjustmentsService.findOne(id, req.user);
  }

  @Patch(":id")
  @Permissions(PermissionsList.STOCK_ADJUST_UPDATE)
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateStockAdjustmentDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.stockAdjustmentsService.update(id, dto, req.user);
  }

  @Delete(":id")
  @Permissions(PermissionsList.STOCK_ADJUST_DELETE)
  async delete(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: DeleteStockAdjustmentDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.stockAdjustmentsService.delete(
      id,
      dto.expectedVersion,
      req.user,
    );
  }

  @Post(":id/approve")
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionsList.STOCK_ADJUST_APPROVE)
  async approve(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ApproveStockAdjustmentDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.stockAdjustmentsService.approve(
      id,
      dto.expectedVersion,
      req.user,
    );
  }
}
