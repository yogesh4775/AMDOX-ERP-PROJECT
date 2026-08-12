import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { SalesService } from "./sales.service";
import { CreateSalesOrderDto } from "./dto/create-sales-order.dto";
import { UpdateSalesOrderDto } from "./dto/update-sales-order.dto";
import { ConfirmSalesOrderDto } from "./dto/confirm-sales-order.dto";
import { DeliverSalesOrderDto } from "./dto/deliver-sales-order.dto";
import { CancelSalesOrderDto } from "./dto/cancel-sales-order.dto";
import { QuerySalesOrderDto } from "./dto/query-sales-order.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../common/constants/permissions.constants";
import { AuthUser } from "../auth/interfaces/auth-user.interface";

@Controller("sales/orders")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PermissionsList.SALES_CREATE)
  async create(
    @Body() dto: CreateSalesOrderDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.salesService.create(dto, req.user);
  }

  @Get()
  @Permissions(PermissionsList.SALES_READ)
  async findAll(
    @Query() query: QuerySalesOrderDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.salesService.findAll(query, req.user);
  }

  @Get(":id")
  @Permissions(PermissionsList.SALES_READ)
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.salesService.findOne(id, req.user);
  }

  @Patch(":id")
  @Permissions(PermissionsList.SALES_UPDATE)
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateSalesOrderDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.salesService.update(id, dto, req.user);
  }

  @Patch(":id/confirm")
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionsList.SALES_CONFIRM)
  async confirm(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ConfirmSalesOrderDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.salesService.confirm(id, dto, req.user);
  }

  @Patch(":id/deliver")
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionsList.SALES_DELIVER)
  async deliver(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: DeliverSalesOrderDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.salesService.deliver(id, dto, req.user);
  }

  @Patch(":id/cancel")
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionsList.SALES_CANCEL)
  async cancel(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CancelSalesOrderDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.salesService.cancel(id, dto, req.user);
  }
}
