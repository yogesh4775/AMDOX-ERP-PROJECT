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
import { StockTransfersService } from "./stock-transfers.service";
import { CreateStockTransferDto } from "./dto/create-transfer.dto";
import { UpdateStockTransferDto } from "./dto/update-transfer.dto";
import { QueryStockTransferDto } from "./dto/query-transfer.dto";
import { DeleteStockTransferDto } from "./dto/delete-transfer.dto";
import { ProcessStockTransferDto } from "./dto/process-transfer.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../common/constants/permissions.constants";
import { AuthUser } from "../auth/interfaces/auth-user.interface";

@Controller("inventory/transfers")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StockTransfersController {
  constructor(private readonly stockTransfersService: StockTransfersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PermissionsList.STOCK_TRANSFER_CREATE)
  async create(
    @Body() dto: CreateStockTransferDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.stockTransfersService.create(dto, req.user);
  }

  @Get()
  @Permissions(PermissionsList.STOCK_TRANSFER_READ)
  async findAll(
    @Query() query: QueryStockTransferDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.stockTransfersService.findAll(query, req.user);
  }

  @Get(":id")
  @Permissions(PermissionsList.STOCK_TRANSFER_READ)
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.stockTransfersService.findOne(id, req.user);
  }

  @Patch(":id")
  @Permissions(PermissionsList.STOCK_TRANSFER_UPDATE)
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateStockTransferDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.stockTransfersService.update(id, dto, req.user);
  }

  @Delete(":id")
  @Permissions(PermissionsList.STOCK_TRANSFER_DELETE)
  async delete(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: DeleteStockTransferDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.stockTransfersService.delete(id, dto.expectedVersion, req.user);
  }

  @Post(":id/process")
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionsList.STOCK_TRANSFER_PROCESS)
  async process(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ProcessStockTransferDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.stockTransfersService.process(
      id,
      dto.expectedVersion,
      req.user,
    );
  }
}
