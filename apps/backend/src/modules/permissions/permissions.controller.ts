import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { PermissionsService } from "./permissions.service";
import { CreatePermissionDto } from "./dto/create-permission.dto";
import { UpdatePermissionDto } from "./dto/update-permission.dto";
import { QueryPermissionDto } from "./dto/query-permission.dto";
import { DeletePermissionDto } from "./dto/delete-permission.dto";
import { RestorePermissionDto } from "./dto/restore-permission.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../common/constants/permissions.constants";
import { AuthUser } from "../auth/interfaces/auth-user.interface";

@Controller("permissions")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Post()
  @Permissions(PermissionsList.PERMISSION_CREATE)
  async create(
    @Body() dto: CreatePermissionDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.permissionsService.create(dto, req.user.id);
  }

  @Get()
  @Permissions(PermissionsList.PERMISSION_READ)
  async findAll(@Query() query: QueryPermissionDto) {
    return this.permissionsService.findAll(query);
  }

  @Get(":id")
  @Permissions(PermissionsList.PERMISSION_READ)
  async findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.permissionsService.findOne(id);
  }

  @Patch(":id")
  @Permissions(PermissionsList.PERMISSION_UPDATE)
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdatePermissionDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.permissionsService.update(id, dto, req.user.id);
  }

  @Delete(":id")
  @Permissions(PermissionsList.PERMISSION_DELETE)
  async remove(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: DeletePermissionDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.permissionsService.remove(id, dto.version, req.user.id);
  }

  @Post(":id/restore")
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionsList.PERMISSION_RESTORE)
  async restore(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RestorePermissionDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.permissionsService.restore(id, dto.version, req.user.id);
  }
}
