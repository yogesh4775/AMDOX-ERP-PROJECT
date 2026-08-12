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
import { BOMService } from "../services/bom.service";
import { CreateBOMDto } from "../dto/create-bom.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../auth/guards/permissions.guard";
import { Permissions } from "../../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../../common/constants/permissions.constants";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";

@Controller("manufacturing/boms")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BOMController {
  constructor(private readonly bomService: BOMService) {}

  @Post()
  @Permissions(PermissionsList.MANUFACTURING_BOM_WRITE)
  async create(@Body() dto: CreateBOMDto, @Req() req: { user: AuthUser }) {
    return this.bomService.create(dto, req.user);
  }

  @Get()
  @Permissions(PermissionsList.MANUFACTURING_BOM_READ)
  async findAll(@Req() req: { user: AuthUser }) {
    return this.bomService.findAll(req.user);
  }

  @Get(":id")
  @Permissions(PermissionsList.MANUFACTURING_BOM_READ)
  async findOne(@Param("id") id: string, @Req() req: { user: AuthUser }) {
    return this.bomService.findOne(id, req.user);
  }

  @Patch(":id")
  @Permissions(PermissionsList.MANUFACTURING_BOM_WRITE)
  async update(
    @Param("id") id: string,
    @Body() dto: Partial<CreateBOMDto> & { expectedVersion?: number },
    @Req() req: { user: AuthUser },
  ) {
    return this.bomService.update(id, dto, req.user);
  }

  @Delete(":id")
  @Permissions(PermissionsList.MANUFACTURING_BOM_WRITE)
  async remove(@Param("id") id: string, @Req() req: { user: AuthUser }) {
    return this.bomService.remove(id, req.user);
  }

  @Post(":id/submit")
  @Permissions(PermissionsList.MANUFACTURING_BOM_WRITE)
  async submit(@Param("id") id: string, @Req() req: { user: AuthUser }) {
    return this.bomService.submit(id, req.user);
  }
}
