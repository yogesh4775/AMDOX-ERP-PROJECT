import { Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { MRPService } from "../services/mrp.service";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../auth/guards/permissions.guard";
import { Permissions } from "../../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../../common/constants/permissions.constants";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";

@Controller("manufacturing/mrp")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MRPController {
  constructor(private readonly mrpService: MRPService) {}

  @Get("requirements")
  @Permissions(PermissionsList.MANUFACTURING_MRP_PROCESS)
  async getRequirements(@Req() req: { user: AuthUser }) {
    return this.mrpService.calculateRequirements(req.user);
  }

  @Post("run")
  @Permissions(PermissionsList.MANUFACTURING_MRP_PROCESS)
  async runMRP(@Req() req: { user: AuthUser }) {
    return this.mrpService.runMRP(req.user);
  }
}
