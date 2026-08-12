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
import { DepartmentsService } from "./departments.service";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { UpdateDepartmentDto } from "./dto/update-department.dto";
import { QueryDepartmentDto } from "./dto/query-department.dto";
import { DeleteDepartmentDto } from "./dto/delete-department.dto";
import { RestoreDepartmentDto } from "./dto/restore-department.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../auth/guards/permissions.guard";
import { Permissions } from "../../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../../common/constants/permissions.constants";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";

@Controller("master-data/departments")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PermissionsList.DEPARTMENT_CREATE)
  async create(
    @Body() dto: CreateDepartmentDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.departmentsService.create(dto, req.user);
  }

  @Get()
  @Permissions(PermissionsList.DEPARTMENT_READ)
  async findAll(
    @Query() query: QueryDepartmentDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.departmentsService.findAll(query, req.user);
  }

  @Get(":id")
  @Permissions(PermissionsList.DEPARTMENT_READ)
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.departmentsService.findOne(id, req.user);
  }

  @Patch(":id")
  @Permissions(PermissionsList.DEPARTMENT_UPDATE)
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateDepartmentDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.departmentsService.update(id, dto, req.user);
  }

  @Delete(":id")
  @Permissions(PermissionsList.DEPARTMENT_DELETE)
  async delete(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: DeleteDepartmentDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.departmentsService.delete(id, dto, req.user);
  }

  @Post(":id/restore")
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionsList.DEPARTMENT_RESTORE)
  async restore(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RestoreDepartmentDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.departmentsService.restore(id, dto, req.user);
  }
}
