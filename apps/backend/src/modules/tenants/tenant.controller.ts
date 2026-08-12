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
import { TenantService } from "./tenant.service";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import { UpdateTenantDto } from "./dto/update-tenant.dto";
import { QueryTenantDto } from "./dto/query-tenant.dto";
import { DeleteTenantDto } from "./dto/delete-tenant.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../common/constants/permissions.constants";
import { AuthUser } from "../auth/interfaces/auth-user.interface";

@Controller("tenants")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  @Permissions(PermissionsList.TENANT_CREATE)
  async create(@Body() dto: CreateTenantDto, @Req() req: { user: AuthUser }) {
    return this.tenantService.create(dto, req.user.id);
  }

  @Get()
  @Permissions(PermissionsList.TENANT_READ)
  async findAll(@Query() query: QueryTenantDto) {
    return this.tenantService.findAll(query);
  }

  @Get(":id")
  @Permissions(PermissionsList.TENANT_READ)
  async findOne(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.tenantService.findOne(id);
  }

  @Patch(":id")
  @Permissions(PermissionsList.TENANT_UPDATE)
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTenantDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.tenantService.update(id, dto, req.user.id);
  }

  @Delete(":id")
  @Permissions(PermissionsList.TENANT_DELETE)
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query() query: DeleteTenantDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.tenantService.remove(id, query.version, req.user.id);
  }
}
