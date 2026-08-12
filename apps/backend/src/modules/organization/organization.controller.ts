import { Controller, Get, Patch, Body, UseGuards, Req } from "@nestjs/common";
import { OrganizationService } from "./organization.service";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../common/constants/permissions.constants";
import { AuthUser } from "../auth/interfaces/auth-user.interface";

@Controller("organization")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get()
  @Permissions(PermissionsList.ORGANIZATION_READ)
  async getOrganization(@Req() req: { user: AuthUser }) {
    const tenantId =
      req.user.tenantId || "00000000-0000-0000-0000-000000000000";
    return this.organizationService.getOrganization(tenantId);
  }

  @Patch()
  @Permissions(PermissionsList.ORGANIZATION_UPDATE)
  async updateOrganization(
    @Body() dto: UpdateOrganizationDto,
    @Req() req: { user: AuthUser },
  ) {
    const tenantId =
      req.user.tenantId || "00000000-0000-0000-0000-000000000000";
    return this.organizationService.updateOrganization(
      tenantId,
      dto,
      req.user.id,
    );
  }
}
