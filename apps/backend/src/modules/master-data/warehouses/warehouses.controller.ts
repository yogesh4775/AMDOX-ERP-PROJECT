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
import { WarehousesService } from "./warehouses.service";
import { CreateWarehouseDto } from "./dto/create-warehouse.dto";
import { UpdateWarehouseDto } from "./dto/update-warehouse.dto";
import { QueryWarehouseDto } from "./dto/query-warehouse.dto";
import { DeleteWarehouseDto } from "./dto/delete-warehouse.dto";
import { RestoreWarehouseDto } from "./dto/restore-warehouse.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../auth/guards/permissions.guard";
import { Permissions } from "../../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../../common/constants/permissions.constants";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";

@Controller("master-data/warehouses")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PermissionsList.WAREHOUSE_CREATE)
  async create(
    @Body() dto: CreateWarehouseDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.warehousesService.create(dto, req.user);
  }

  @Get()
  @Permissions(PermissionsList.WAREHOUSE_READ)
  async findAll(
    @Query() query: QueryWarehouseDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.warehousesService.findAll(query, req.user);
  }

  @Get(":id")
  @Permissions(PermissionsList.WAREHOUSE_READ)
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.warehousesService.findOne(id, req.user);
  }

  @Patch(":id")
  @Permissions(PermissionsList.WAREHOUSE_UPDATE)
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateWarehouseDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.warehousesService.update(id, dto, req.user);
  }

  @Delete(":id")
  @Permissions(PermissionsList.WAREHOUSE_DELETE)
  async delete(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: DeleteWarehouseDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.warehousesService.delete(id, dto, req.user);
  }

  @Post(":id/restore")
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionsList.WAREHOUSE_RESTORE)
  async restore(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RestoreWarehouseDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.warehousesService.restore(id, dto, req.user);
  }
}
