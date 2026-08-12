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
import { RolesService } from "./roles.service";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { QueryRoleDto } from "./dto/query-role.dto";
import { AssignPermissionsDto } from "./dto/assign-permissions.dto";
import { CloneRoleDto } from "./dto/clone-role.dto";
import { DeleteRoleDto } from "./dto/delete-role.dto";
import { RestoreRoleDto } from "./dto/restore-role.dto";
import { UpdateRoleStatusDto } from "./dto/update-role-status.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../common/constants/permissions.constants";
import { AuthUser } from "../auth/interfaces/auth-user.interface";

@Controller("roles")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @Permissions(PermissionsList.ROLE_CREATE)
  async create(@Body() dto: CreateRoleDto, @Req() req: { user: AuthUser }) {
    const tenantId =
      req.user.tenantId || "00000000-0000-0000-0000-000000000000";
    return this.rolesService.create(dto, tenantId, req.user.id);
  }

  @Get()
  @Permissions(PermissionsList.ROLE_READ)
  async findAll(@Query() query: QueryRoleDto, @Req() req: { user: AuthUser }) {
    const tenantId =
      req.user.tenantId || "00000000-0000-0000-0000-000000000000";
    return this.rolesService.findAll(query, tenantId);
  }

  @Get(":id")
  @Permissions(PermissionsList.ROLE_READ)
  async findOne(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: { user: AuthUser },
  ) {
    const tenantId =
      req.user.tenantId || "00000000-0000-0000-0000-000000000000";
    return this.rolesService.findOne(id, tenantId);
  }

  @Patch(":id")
  @Permissions(PermissionsList.ROLE_UPDATE)
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateRoleDto,
    @Req() req: { user: AuthUser },
  ) {
    const tenantId =
      req.user.tenantId || "00000000-0000-0000-0000-000000000000";
    return this.rolesService.update(id, dto, tenantId, req.user.id);
  }

  @Delete(":id")
  @Permissions(PermissionsList.ROLE_DELETE)
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query() query: DeleteRoleDto,
    @Req() req: { user: AuthUser },
  ) {
    const tenantId =
      req.user.tenantId || "00000000-0000-0000-0000-000000000000";
    return this.rolesService.remove(id, query.version, tenantId, req.user.id);
  }

  @Post(":id/restore")
  @Permissions(PermissionsList.ROLE_RESTORE)
  @HttpCode(HttpStatus.OK)
  async restore(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: RestoreRoleDto,
    @Req() req: { user: AuthUser },
  ) {
    const tenantId =
      req.user.tenantId || "00000000-0000-0000-0000-000000000000";
    return this.rolesService.restore(id, dto.version, tenantId, req.user.id);
  }

  @Post(":id/clone")
  @Permissions(PermissionsList.ROLE_CLONE)
  async clone(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: CloneRoleDto,
    @Req() req: { user: AuthUser },
  ) {
    const tenantId =
      req.user.tenantId || "00000000-0000-0000-0000-000000000000";
    return this.rolesService.clone(id, dto, tenantId, req.user.id);
  }

  @Patch(":id/permissions")
  @Permissions(PermissionsList.ROLE_ASSIGN_PERMISSION)
  async assignPermissions(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: AssignPermissionsDto,
    @Req() req: { user: AuthUser },
  ) {
    const tenantId =
      req.user.tenantId || "00000000-0000-0000-0000-000000000000";
    return this.rolesService.assignPermissions(id, dto, tenantId, req.user.id);
  }

  @Patch(":id/status")
  @Permissions(PermissionsList.ROLE_UPDATE)
  async updateStatus(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateRoleStatusDto,
    @Req() req: { user: AuthUser },
  ) {
    const tenantId =
      req.user.tenantId || "00000000-0000-0000-0000-000000000000";
    const updateDto: UpdateRoleDto = {
      version: dto.version,
      isActive: dto.isActive,
    };
    return this.rolesService.update(id, updateDto, tenantId, req.user.id);
  }
}
