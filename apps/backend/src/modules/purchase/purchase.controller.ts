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
import { PurchaseService } from "./purchase.service";
import { CreatePurchaseOrderDto } from "./dto/create-purchase-order.dto";
import { UpdatePurchaseOrderDto } from "./dto/update-purchase-order.dto";
import { ApprovePurchaseOrderDto } from "./dto/approve-purchase-order.dto";
import { ReceivePurchaseOrderDto } from "./dto/receive-purchase-order.dto";
import { CancelPurchaseOrderDto } from "./dto/cancel-purchase-order.dto";
import { QueryPurchaseOrderDto } from "./dto/query-purchase-order.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../common/constants/permissions.constants";
import { AuthUser } from "../auth/interfaces/auth-user.interface";

@Controller("purchase")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PurchaseController {
  constructor(private readonly purchaseService: PurchaseService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PermissionsList.PURCHASE_CREATE)
  async create(
    @Body() dto: CreatePurchaseOrderDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.purchaseService.create(dto, req.user);
  }

  @Get()
  @Permissions(PermissionsList.PURCHASE_READ)
  async findAll(
    @Query() query: QueryPurchaseOrderDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.purchaseService.findAll(query, req.user);
  }

  @Get(":id")
  @Permissions(PermissionsList.PURCHASE_READ)
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.purchaseService.findOne(id, req.user);
  }

  @Patch(":id")
  @Permissions(PermissionsList.PURCHASE_UPDATE)
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdatePurchaseOrderDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.purchaseService.update(id, dto, req.user);
  }

  @Patch(":id/approve")
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionsList.PURCHASE_APPROVE)
  async approve(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ApprovePurchaseOrderDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.purchaseService.approve(id, dto, req.user);
  }

  @Patch(":id/receive")
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionsList.PURCHASE_RECEIVE)
  async receive(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ReceivePurchaseOrderDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.purchaseService.receive(id, dto, req.user);
  }

  @Patch(":id/cancel")
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionsList.PURCHASE_CANCEL)
  async cancel(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CancelPurchaseOrderDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.purchaseService.cancel(id, dto, req.user);
  }
}
