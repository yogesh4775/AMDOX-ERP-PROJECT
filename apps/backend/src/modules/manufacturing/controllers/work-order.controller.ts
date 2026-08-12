import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { WorkOrderService } from "../services/work-order.service";
import { CreateWorkOrderDto } from "../dto/create-work-order.dto";
import { LogOperationDto } from "../dto/log-operation.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../auth/guards/permissions.guard";
import { Permissions } from "../../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../../common/constants/permissions.constants";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";

@Controller("manufacturing/work-orders")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WorkOrderController {
  constructor(private readonly workOrderService: WorkOrderService) {}

  @Get("export/csv")
  @Permissions(PermissionsList.MANUFACTURING_WORK_ORDER_READ)
  async exportCsv(@Req() req: { user: AuthUser }, @Res() res: Response) {
    const orders = await this.workOrderService.findAll(req.user);
    let csv = "Code,Product,BOM,Routing,Quantity,Status\n";
    for (const order of orders) {
      csv += `${order.code},${order.product.name},${order.bom.name},${order.routing.name},${order.quantity},${order.status}\n`;
    }
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=work_orders.csv",
    );
    return res.status(200).send(csv);
  }

  @Post()
  @Permissions(PermissionsList.MANUFACTURING_WORK_ORDER_WRITE)
  async create(
    @Body() dto: CreateWorkOrderDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.workOrderService.create(dto, req.user);
  }

  @Get()
  @Permissions(PermissionsList.MANUFACTURING_WORK_ORDER_READ)
  async findAll(@Req() req: { user: AuthUser }) {
    return this.workOrderService.findAll(req.user);
  }

  @Get(":id")
  @Permissions(PermissionsList.MANUFACTURING_WORK_ORDER_READ)
  async findOne(@Param("id") id: string, @Req() req: { user: AuthUser }) {
    return this.workOrderService.findOne(id, req.user);
  }

  @Post(":id/submit")
  @Permissions(PermissionsList.MANUFACTURING_WORK_ORDER_WRITE)
  async submit(@Param("id") id: string, @Req() req: { user: AuthUser }) {
    return this.workOrderService.submit(id, req.user);
  }

  @Post(":id/start")
  @Permissions(PermissionsList.MANUFACTURING_WORK_ORDER_PROCESS)
  async start(@Param("id") id: string, @Req() req: { user: AuthUser }) {
    return this.workOrderService.start(id, req.user);
  }

  @Post(":id/operations/:seq/log")
  @Permissions(PermissionsList.MANUFACTURING_WORK_ORDER_PROCESS)
  async logOperation(
    @Param("id") id: string,
    @Param("seq") seq: string,
    @Body() dto: LogOperationDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.workOrderService.logOperation(
      id,
      parseInt(seq, 10),
      dto,
      req.user,
    );
  }

  @Post(":id/complete")
  @Permissions(PermissionsList.MANUFACTURING_WORK_ORDER_PROCESS)
  async complete(@Param("id") id: string, @Req() req: { user: AuthUser }) {
    return this.workOrderService.complete(id, req.user);
  }

  @Post(":id/cancel")
  @Permissions(PermissionsList.MANUFACTURING_WORK_ORDER_PROCESS)
  async cancel(@Param("id") id: string, @Req() req: { user: AuthUser }) {
    return this.workOrderService.cancel(id, req.user);
  }
}
