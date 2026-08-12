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
import { WorkCenterService } from "../services/work-center.service";
import { CreateWorkCenterDto } from "../dto/create-work-center.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../auth/guards/permissions.guard";
import { Permissions } from "../../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../../common/constants/permissions.constants";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";

@Controller("manufacturing/work-centers")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WorkCenterController {
  constructor(private readonly workCenterService: WorkCenterService) {}

  @Post()
  @Permissions(PermissionsList.MANUFACTURING_WORK_CENTER_WRITE)
  async create(
    @Body() dto: CreateWorkCenterDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.workCenterService.create(dto, req.user);
  }

  @Get()
  @Permissions(PermissionsList.MANUFACTURING_WORK_CENTER_READ)
  async findAll(@Req() req: { user: AuthUser }) {
    return this.workCenterService.findAll(req.user);
  }

  @Get(":id")
  @Permissions(PermissionsList.MANUFACTURING_WORK_CENTER_READ)
  async findOne(@Param("id") id: string, @Req() req: { user: AuthUser }) {
    return this.workCenterService.findOne(id, req.user);
  }

  @Patch(":id")
  @Permissions(PermissionsList.MANUFACTURING_WORK_CENTER_WRITE)
  async update(
    @Param("id") id: string,
    @Body() dto: Partial<CreateWorkCenterDto> & { expectedVersion?: number },
    @Req() req: { user: AuthUser },
  ) {
    return this.workCenterService.update(id, dto, req.user);
  }

  @Delete(":id")
  @Permissions(PermissionsList.MANUFACTURING_WORK_CENTER_WRITE)
  async remove(@Param("id") id: string, @Req() req: { user: AuthUser }) {
    return this.workCenterService.remove(id, req.user);
  }
}
