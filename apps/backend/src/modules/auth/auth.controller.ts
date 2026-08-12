/* eslint-disable */
import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from "@nestjs/common";
import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { MfaEnableDto } from "./dto/mfa-enable.dto";
import { MfaDisableDto } from "./dto/mfa-disable.dto";
import { MfaVerifyDto } from "./dto/mfa-verify.dto";
import { UpdateEmailDto } from "./dto/update-email.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { AuthUser } from "./interfaces/auth-user.interface";
import { SessionsService } from "../sessions/sessions.service";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionsService: SessionsService,
  ) {}

  @Post("register")
  @HttpCode(HttpStatus.OK)
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const userAgent = req.headers["user-agent"];
    const ipAddress = req.ip;
    return this.authService.register(dto, ipAddress, userAgent);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userAgent = req.headers["user-agent"];
    const ipAddress = req.ip;
    const result = await this.authService.login(dto, ipAddress, userAgent);

    // Secure Cookie support if tokens are returned directly
    if (result && "accessToken" in result) {
      res.cookie("accessToken", result.accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
      });
      res.cookie("refreshToken", result.refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
      });
    }

    return result;
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userAgent = req.headers["user-agent"];
    const ipAddress = req.ip;
    const result = await this.authService.refresh(dto, ipAddress, userAgent);

    res.cookie("accessToken", result.accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    });
    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    });

    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: { user: AuthUser }, @Res({ passthrough: true }) res: Response) {
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    return this.authService.logout(req.user.tokenId);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  async getMe(@Req() req: { user: AuthUser }) {
    return this.authService.getMe(req.user.id);
  }

  // --- Email Verification ---

  @Post("verify-email")
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body("token") token: string, @Req() req: Request) {
    const userAgent = req.headers["user-agent"];
    const ipAddress = req.ip;
    return this.authService.verifyEmail(token, ipAddress, userAgent);
  }

  @Post("resend-verification")
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body("email") email: string, @Req() req: Request) {
    const userAgent = req.headers["user-agent"];
    const ipAddress = req.ip;
    return this.authService.resendVerificationEmail(email, ipAddress, userAgent);
  }

  @UseGuards(JwtAuthGuard)
  @Post("email/change")
  @HttpCode(HttpStatus.OK)
  async initiateEmailChange(@Body() dto: UpdateEmailDto, @Req() req: { user: AuthUser }) {
    return this.authService.initiateEmailChange(dto.newEmail, dto.expectedVersion, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post("email/change/confirm")
  @HttpCode(HttpStatus.OK)
  async confirmEmailChange(@Body("token") token: string, @Req() req: { user: AuthUser }) {
    return this.authService.confirmEmailChange(token, req.user);
  }

  // --- Password Management ---

  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    const userAgent = req.headers["user-agent"];
    const ipAddress = req.ip;
    return this.authService.forgotPassword(dto, ipAddress, userAgent);
  }

  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    const userAgent = req.headers["user-agent"];
    const ipAddress = req.ip;
    return this.authService.resetPassword(dto, ipAddress, userAgent);
  }

  @UseGuards(JwtAuthGuard)
  @Post("change-password")
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() req: { user: AuthUser; ip: string; headers: Record<string, string | undefined> },
  ) {
    const userAgent = req.headers["user-agent"];
    const ipAddress = req.ip;
    return this.authService.changePassword(dto, req.user, ipAddress, userAgent);
  }

  // --- MFA Flow ---

  @UseGuards(JwtAuthGuard)
  @Get("mfa/setup")
  async setupMfa(@Req() req: { user: AuthUser }) {
    return this.authService.setupMfa(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post("mfa/enable")
  @HttpCode(HttpStatus.OK)
  async enableMfa(
    @Body() dto: MfaEnableDto,
    @Query("secret") secret: string,
    @Req() req: { user: AuthUser; ip: string; headers: Record<string, string | undefined> },
  ) {
    const userAgent = req.headers["user-agent"];
    const ipAddress = req.ip;
    return this.authService.enableMfa(dto, secret, req.user, ipAddress, userAgent);
  }

  @UseGuards(JwtAuthGuard)
  @Post("mfa/disable")
  @HttpCode(HttpStatus.OK)
  async disableMfa(
    @Body() dto: MfaDisableDto,
    @Req() req: { user: AuthUser; ip: string; headers: Record<string, string | undefined> },
  ) {
    const userAgent = req.headers["user-agent"];
    const ipAddress = req.ip;
    return this.authService.disableMfa(dto, req.user, ipAddress, userAgent);
  }

  @Post("mfa/verify")
  @HttpCode(HttpStatus.OK)
  async verifyMfa(@Body() dto: MfaVerifyDto, @Req() req: Request) {
    const userAgent = req.headers["user-agent"];
    const ipAddress = req.ip;
    return this.authService.verifyMfa(dto, ipAddress, userAgent);
  }

  // --- Session & Device Management ---

  @UseGuards(JwtAuthGuard)
  @Get("sessions/active")
  async getActiveSessions(@Req() req: { user: AuthUser }) {
    return this.sessionsService.getSessions(
      { page: 1, limit: 100, order: "asc" },
      req.user,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete("sessions/:id")
  async revokeSession(
    @Param("id") id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.sessionsService.revokeSession(id, { version: undefined }, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post("sessions/logout-all")
  @HttpCode(HttpStatus.OK)
  async logoutAllSessions(@Req() req: { user: AuthUser }) {
    return this.sessionsService.revokeAllSessionsIncludingCurrent(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post("devices/trust")
  @HttpCode(HttpStatus.OK)
  async trustDevice(
    @Body() body: { fingerprint: string; details: string },
    @Req() req: { user: AuthUser },
  ) {
    return this.authService.trustDevice(body.fingerprint, body.details, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Delete("devices/trust/:fingerprint")
  async removeTrustedDevice(
    @Param("fingerprint") fingerprint: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.authService.removeTrustedDevice(fingerprint, req.user);
  }
}
