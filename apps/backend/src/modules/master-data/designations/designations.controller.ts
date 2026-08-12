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
import { DesignationsService } from "./designations.service";
import { CreateDesignationDto } from "./dto/create-designation.dto";
import { UpdateDesignationDto } from "./dto/update-designation.dto";
import { QueryDesignationDto } from "./dto/query-designation.dto";
import { DeleteDesignationDto } from "./dto/delete-designation.dto";
import { RestoreDesignationDto } from "./dto/restore-designation.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../auth/guards/permissions.guard";
import { Permissions } from "../../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../../common/constants/permissions.constants";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";

@Controller("master-data/designations")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DesignationsController {
  constructor(private readonly designationsService: DesignationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PermissionsList.DESIGNATION_CREATE)
  async create(
    @Body() dto: CreateDesignationDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.designationsService.create(dto, req.user);
  }

  @Get()
  @Permissions(PermissionsList.DESIGNATION_READ)
  async findAll(
    @Query() query: QueryDesignationDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.designationsService.findAll(query, req.user);
  }

  @Get(":id")
  @Permissions(PermissionsList.DESIGNATION_READ)
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.designationsService.findOne(id, req.user);
  }

  @Patch(":id")
  @Permissions(PermissionsList.DESIGNATION_UPDATE)
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateDesignationDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.designationsService.update(id, dto, req.user);
  }

  @Delete(":id")
  @Permissions(PermissionsList.DESIGNATION_DELETE)
  async delete(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: DeleteDesignationDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.designationsService.delete(id, dto, req.user);
  }

  @Post(":id/restore")
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionsList.DESIGNATION_RESTORE)
  async restore(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RestoreDesignationDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.designationsService.restore(id, dto, req.user);
  }
}
