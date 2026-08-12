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
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { QueryUserDto } from "./dto/query-user.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { AssignRolesDto } from "./dto/assign-roles.dto";
import { UpdateUserStatusDto } from "./dto/update-user-status.dto";
import { DeleteUserDto } from "./dto/delete-user.dto";
import { RestoreUserDto } from "./dto/restore-user.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../common/constants/permissions.constants";
import { AuthUser } from "../auth/interfaces/auth-user.interface";

@Controller("users")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Permissions(PermissionsList.USER_CREATE)
  async create(@Body() dto: CreateUserDto, @Req() req: { user: AuthUser }) {
    const tenantId =
      req.user.tenantId || "00000000-0000-0000-0000-000000000000";
    return this.usersService.create(dto, tenantId, req.user.id);
  }

  @Get()
  @Permissions(PermissionsList.USER_READ)
  async findAll(@Query() query: QueryUserDto, @Req() req: { user: AuthUser }) {
    const tenantId =
      req.user.tenantId || "00000000-0000-0000-0000-000000000000";
    return this.usersService.findAll(query, tenantId);
  }

  @Get(":id")
  @Permissions(PermissionsList.USER_READ)
  async findOne(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: { user: AuthUser },
  ) {
    const tenantId =
      req.user.tenantId || "00000000-0000-0000-0000-000000000000";
    return this.usersService.findOne(id, tenantId);
  }

  @Patch(":id")
  @Permissions(PermissionsList.USER_UPDATE)
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: { user: AuthUser },
  ) {
    const tenantId =
      req.user.tenantId || "00000000-0000-0000-0000-000000000000";
    return this.usersService.update(id, dto, tenantId, req.user.id);
  }

  @Delete(":id")
  @Permissions(PermissionsList.USER_DELETE)
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query() query: DeleteUserDto,
    @Req() req: { user: AuthUser },
  ) {
    const tenantId =
      req.user.tenantId || "00000000-0000-0000-0000-000000000000";
    return this.usersService.remove(id, query.version, tenantId, req.user.id);
  }

  @Patch(":id/password")
  @Permissions(PermissionsList.USER_CHANGE_PASSWORD)
  async changePassword(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: ChangePasswordDto,
    @Req() req: { user: AuthUser },
  ) {
    const tenantId =
      req.user.tenantId || "00000000-0000-0000-0000-000000000000";
    return this.usersService.changePassword(id, dto, tenantId, req.user.id);
  }

  @Patch(":id/status")
  @Permissions(PermissionsList.USER_UPDATE)
  async updateStatus(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserStatusDto,
    @Req() req: { user: AuthUser },
  ) {
    const tenantId =
      req.user.tenantId || "00000000-0000-0000-0000-000000000000";
    return this.usersService.updateStatus(id, dto, tenantId, req.user.id);
  }

  @Patch(":id/roles")
  @Permissions(PermissionsList.USER_ASSIGN_ROLE)
  async assignRoles(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: AssignRolesDto,
    @Req() req: { user: AuthUser },
  ) {
    const tenantId =
      req.user.tenantId || "00000000-0000-0000-0000-000000000000";
    return this.usersService.assignRoles(id, dto, tenantId, req.user.id);
  }

  @Post(":id/restore")
  @Permissions(PermissionsList.USER_RESTORE)
  @HttpCode(HttpStatus.OK)
  async restore(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: RestoreUserDto,
    @Req() req: { user: AuthUser },
  ) {
    const tenantId =
      req.user.tenantId || "00000000-0000-0000-0000-000000000000";
    return this.usersService.restore(id, dto.version, tenantId, req.user.id);
  }
}
