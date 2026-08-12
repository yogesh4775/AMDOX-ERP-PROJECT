import {
  Controller,
  Get,
  Delete,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  ParseUUIDPipe,
} from "@nestjs/common";
import { SessionsService } from "./sessions.service";
import { QuerySessionDto } from "./dto/query-session.dto";
import { RevokeSessionDto } from "./dto/revoke-session.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../common/constants/permissions.constants";
import { AuthUser } from "../auth/interfaces/auth-user.interface";

@Controller("sessions")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  @Permissions(PermissionsList.SESSION_READ)
  async getSessions(
    @Query() query: QuerySessionDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.sessionsService.getSessions(query, req.user);
  }

  @Get(":id")
  @Permissions(PermissionsList.SESSION_READ)
  async getSessionDetails(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.sessionsService.getSessionDetails(id, req.user);
  }

  @Delete(":id")
  @Permissions(PermissionsList.SESSION_REVOKE)
  async revokeSessionDelete(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: RevokeSessionDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.sessionsService.revokeSession(id, dto, req.user);
  }

  @Patch(":id/revoke")
  @Permissions(PermissionsList.SESSION_REVOKE)
  async revokeSessionPatch(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: RevokeSessionDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.sessionsService.revokeSession(id, dto, req.user);
  }

  @Delete()
  @Permissions(PermissionsList.SESSION_REVOKE_ALL)
  async revokeAllSessions(
    @Query("excludeCurrent") excludeCurrent: string,
    @Req() req: { user: AuthUser },
  ) {
    const shouldExclude = excludeCurrent === "true";
    if (shouldExclude) {
      return this.sessionsService.revokeAllSessionsExceptCurrent(req.user);
    } else {
      return this.sessionsService.revokeAllSessionsIncludingCurrent(req.user);
    }
  }
}
