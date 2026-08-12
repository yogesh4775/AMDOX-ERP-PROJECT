import { Controller, Get, Query, UseGuards, Req } from "@nestjs/common";
import { DashboardService } from "./dashboard.service";
import { QueryDashboardDto } from "./dto/query-dashboard.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../common/constants/permissions.constants";
import { AuthUser } from "../auth/interfaces/auth-user.interface";

@Controller("dashboard")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @Permissions(PermissionsList.DASHBOARD_READ)
  async getDashboardCombined(
    @Query() query: QueryDashboardDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.dashboardService.getDashboardCombined(query, req.user);
  }

  @Get("summary")
  @Permissions(PermissionsList.DASHBOARD_READ)
  async getDashboardSummary(
    @Query() query: QueryDashboardDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.dashboardService.getDashboardSummary(req.user, query);
  }

  @Get("charts")
  @Permissions(PermissionsList.DASHBOARD_READ)
  async getDashboardCharts(
    @Query() query: QueryDashboardDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.dashboardService.getDashboardCharts(req.user, query);
  }

  @Get("activity")
  @Permissions(PermissionsList.DASHBOARD_READ)
  async getRecentActivity(
    @Query() query: QueryDashboardDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.dashboardService.getRecentActivity(query, req.user);
  }

  @Get("recent")
  @Permissions(PermissionsList.DASHBOARD_READ)
  async getRecentActivityFeed(
    @Query() query: QueryDashboardDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.dashboardService.getRecentActivityFeed(req.user, query);
  }

  @Get("notifications")
  @Permissions(PermissionsList.DASHBOARD_READ)
  async getDashboardNotifications(@Req() req: { user: AuthUser }) {
    return this.dashboardService.getDashboardNotifications(req.user);
  }
}
