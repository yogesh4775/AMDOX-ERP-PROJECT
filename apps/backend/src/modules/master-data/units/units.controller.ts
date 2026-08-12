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
import { UnitsService } from "./units.service";
import { CreateUnitDto } from "./dto/create-unit.dto";
import { UpdateUnitDto } from "./dto/update-unit.dto";
import { QueryUnitDto } from "./dto/query-unit.dto";
import { DeleteUnitDto } from "./dto/delete-unit.dto";
import { RestoreUnitDto } from "./dto/restore-unit.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../auth/guards/permissions.guard";
import { Permissions } from "../../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../../common/constants/permissions.constants";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";

@Controller("master-data/units")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PermissionsList.UNIT_CREATE)
  async create(@Body() dto: CreateUnitDto, @Req() req: { user: AuthUser }) {
    return this.unitsService.create(dto, req.user);
  }

  @Get()
  @Permissions(PermissionsList.UNIT_READ)
  async findAll(@Query() query: QueryUnitDto, @Req() req: { user: AuthUser }) {
    return this.unitsService.findAll(query, req.user);
  }

  @Get(":id")
  @Permissions(PermissionsList.UNIT_READ)
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.unitsService.findOne(id, req.user);
  }

  @Patch(":id")
  @Permissions(PermissionsList.UNIT_UPDATE)
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateUnitDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.unitsService.update(id, dto, req.user);
  }

  @Delete(":id")
  @Permissions(PermissionsList.UNIT_DELETE)
  async delete(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: DeleteUnitDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.unitsService.delete(id, dto, req.user);
  }

  @Post(":id/restore")
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionsList.UNIT_RESTORE)
  async restore(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RestoreUnitDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.unitsService.restore(id, dto, req.user);
  }
}
