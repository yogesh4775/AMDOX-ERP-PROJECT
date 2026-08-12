import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from "@nestjs/common";
import { RoutingService } from "../services/routing.service";
import { CreateRoutingDto } from "../dto/create-routing.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../auth/guards/permissions.guard";
import { Permissions } from "../../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../../common/constants/permissions.constants";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";

@Controller("manufacturing/routings")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RoutingController {
  constructor(private readonly routingService: RoutingService) {}

  @Post()
  @Permissions(PermissionsList.MANUFACTURING_ROUTING_WRITE)
  async create(@Body() dto: CreateRoutingDto, @Req() req: { user: AuthUser }) {
    return this.routingService.create(dto, req.user);
  }

  @Get()
  @Permissions(PermissionsList.MANUFACTURING_ROUTING_READ)
  async findAll(@Req() req: { user: AuthUser }) {
    return this.routingService.findAll(req.user);
  }

  @Get(":id")
  @Permissions(PermissionsList.MANUFACTURING_ROUTING_READ)
  async findOne(@Param("id") id: string, @Req() req: { user: AuthUser }) {
    return this.routingService.findOne(id, req.user);
  }

  @Patch(":id")
  @Permissions(PermissionsList.MANUFACTURING_ROUTING_WRITE)
  async update(
    @Param("id") id: string,
    @Body() dto: Partial<CreateRoutingDto> & { expectedVersion?: number },
    @Req() req: { user: AuthUser },
  ) {
    return this.routingService.update(id, dto, req.user);
  }

  @Delete(":id")
  @Permissions(PermissionsList.MANUFACTURING_ROUTING_WRITE)
  async remove(@Param("id") id: string, @Req() req: { user: AuthUser }) {
    return this.routingService.remove(id, req.user);
  }
}
