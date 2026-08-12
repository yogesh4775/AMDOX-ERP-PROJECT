import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  ParseUUIDPipe,
} from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { QueryNotificationDto } from "./dto/query-notification.dto";
import { MarkReadDto } from "./dto/mark-read.dto";
import { DeleteNotificationDto } from "./dto/delete-notification.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../common/constants/permissions.constants";
import { AuthUser } from "../auth/interfaces/auth-user.interface";

@Controller("notifications")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Permissions(PermissionsList.NOTIFICATION_READ)
  async findAll(
    @Query() query: QueryNotificationDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.notificationsService.findAll(query, req.user);
  }

  @Get(":id")
  @Permissions(PermissionsList.NOTIFICATION_READ)
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.notificationsService.findOne(id, req.user);
  }

  @Patch("read-all")
  @Permissions(PermissionsList.NOTIFICATION_UPDATE)
  async markAllAsRead(@Req() req: { user: AuthUser }) {
    return this.notificationsService.markAllAsRead(req.user);
  }

  @Patch(":id/read")
  @Permissions(PermissionsList.NOTIFICATION_UPDATE)
  async markAsRead(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: MarkReadDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.notificationsService.markAsRead(id, dto, req.user);
  }

  @Delete(":id")
  @Permissions(PermissionsList.NOTIFICATION_DELETE)
  async delete(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: DeleteNotificationDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.notificationsService.delete(id, dto, req.user);
  }

  @Delete()
  @Permissions(PermissionsList.NOTIFICATION_DELETE)
  async deleteAll(@Req() req: { user: AuthUser }) {
    return this.notificationsService.deleteAll(req.user);
  }
}
