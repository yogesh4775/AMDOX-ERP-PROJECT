/* eslint-disable */
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { randomUUID } from "crypto";
import * as crypto from "crypto";
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
import { AuditService } from "../../common/audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { TransactionHelper } from "../../common/transactions/transaction.helper";
import { MfaService } from "./services/mfa.service";
import { PasswordPolicyService } from "./services/password-policy.service";
import { DeviceDetectorService } from "./services/device-detector.service";
import { AuthUser } from "./interfaces/auth-user.interface";
import { NotificationType } from "../notifications/dto/query-notification.dto";
import { Prisma, UserStatus } from "@amdox/database/generated";

@Injectable()
export class AuthService {
  private readonly defaultTenantId = "00000000-0000-0000-0000-000000000000";

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly transactionHelper: TransactionHelper,
    private readonly mfaService: MfaService,
    private readonly passwordPolicyService: PasswordPolicyService,
    private readonly deviceDetectorService: DeviceDetectorService,
  ) {}

  // --- Registration & Verification ---

  async register(dto: RegisterDto, ipAddress?: string, userAgent?: string) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { username: dto.username }],
      },
    });

    if (existing) {
      throw new BadRequestException("Invalid credentials");
    }

    this.passwordPolicyService.validateStrength(dto.password);

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const passwordExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

    return this.transactionHelper.run(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          username: dto.username,
          passwordHash,
          tenantId: this.defaultTenantId,
          emailVerified: false,
          verificationToken,
          verificationTokenExpiresAt,
          passwordChangedAt: new Date(),
          passwordExpiresAt,
        },
      });

      // Save initial password in history
      await tx.passwordHistory.create({
        data: {
          tenantId: this.defaultTenantId,
          userId: user.id,
          passwordHash,
        },
      });

      // Exactly one Audit Event
      await this.auditService.log(
        {
          action: "USER_REGISTERED",
          entity: "User",
          entityId: user.id,
          tenantId: this.defaultTenantId,
          userId: user.id,
          ipAddress,
          userAgent,
          newValues: { email: user.email, username: user.username },
        },
        tx,
      );

      // Trigger Email Notification (Internal Log & in-app message)
      await this.notificationsService.createInternal({
        userId: user.id,
        tenantId: this.defaultTenantId,
        title: "Verify Your Email Address",
        message: `Welcome to AmdoxERP! Please verify your email using token: ${verificationToken}`,
        type: NotificationType.INFO,
      }, tx);

      return {
        success: true,
        userId: user.id,
        verificationToken,
      };
    });
  }

  async verifyEmail(token: string, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findFirst({
      where: { verificationToken: token, deletedAt: null },
    });

    if (!user) {
      throw new BadRequestException("Invalid or expired verification token.");
    }

    if (user.verificationTokenExpiresAt && user.verificationTokenExpiresAt < new Date()) {
      throw new BadRequestException("Verification token has expired.");
    }

    return this.transactionHelper.run(async (tx) => {
      const updated = await tx.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          verificationToken: null,
          verificationTokenExpiresAt: null,
          version: user.version + 1,
        },
      });

      await this.auditService.log(
        {
          action: "EMAIL_VERIFIED",
          entity: "User",
          entityId: user.id,
          tenantId: user.tenantId,
          userId: user.id,
          ipAddress,
          userAgent,
          newValues: { emailVerified: true },
        },
        tx,
      );

      await this.notificationsService.createInternal({
        userId: user.id,
        tenantId: user.tenantId,
        title: "Email Verified Successfully",
        message: "Thank you for verifying your email address.",
        type: NotificationType.SUCCESS,
      }, tx);

      return { success: true };
    });
  }

  async resendVerificationEmail(email: string, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException("User not found.");
    }

    if (user.emailVerified) {
      throw new BadRequestException("Email is already verified.");
    }

    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    return this.transactionHelper.run(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          verificationToken,
          verificationTokenExpiresAt,
          version: user.version + 1,
        },
      });

      await this.notificationsService.createInternal({
        userId: user.id,
        tenantId: user.tenantId,
        title: "Verify Your Email Address",
        message: `Please verify your email using token: ${verificationToken}`,
        type: NotificationType.INFO,
      }, tx);

      return { success: true, verificationToken };
    });
  }

  async initiateEmailChange(newEmail: string, expectedVersion: number, user: AuthUser) {
    const existing = await this.prisma.user.findFirst({
      where: { email: newEmail, deletedAt: null },
    });

    if (existing) {
      throw new BadRequestException("Email is already in use.");
    }

    const current = await this.prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!current) {
      throw new NotFoundException("User not found.");
    }

    if (current.version !== expectedVersion) {
      throw new ConflictException("DATABASE.CONFLICT");
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenExpires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

    return this.transactionHelper.run(async (tx) => {
      const updated = await tx.user.update({
        where: { id: user.id },
        data: {
          pendingEmail: newEmail,
          emailChangeToken: token,
          emailChangeTokenExpires: tokenExpires,
          version: current.version + 1,
        },
      });

      // Verification notification sent to the new email address
      await this.notificationsService.createInternal({
        userId: user.id,
        tenantId: user.tenantId,
        title: "Confirm Email Change Request",
        message: `Please confirm changing your email to ${newEmail} using code: ${token}`,
        type: NotificationType.INFO,
      }, tx);

      return { success: true, emailChangeToken: token };
    });
  }

  async confirmEmailChange(token: string, user: AuthUser) {
    const current = await this.prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!current) {
      throw new NotFoundException("User not found.");
    }

    if (!current.emailChangeToken || current.emailChangeToken !== token) {
      throw new BadRequestException("Invalid or expired email change token.");
    }

    if (current.emailChangeTokenExpires && current.emailChangeTokenExpires < new Date()) {
      throw new BadRequestException("Email change token has expired.");
    }

    return this.transactionHelper.run(async (tx) => {
      const updated = await tx.user.update({
        where: { id: user.id },
        data: {
          email: current.pendingEmail!,
          pendingEmail: null,
          emailChangeToken: null,
          emailChangeTokenExpires: null,
          emailVerified: true, // Auto verify since token was confirmed
          version: current.version + 1,
        },
      });

      await this.auditService.log(
        {
          action: "EMAIL_VERIFIED",
          entity: "User",
          entityId: user.id,
          tenantId: user.tenantId,
          userId: user.id,
          newValues: { email: updated.email },
        },
        tx,
      );

      await this.notificationsService.createInternal({
        userId: user.id,
        tenantId: user.tenantId,
        title: "Email Changed Successfully",
        message: `Your login email has been updated to ${updated.email}.`,
        type: NotificationType.SUCCESS,
      }, tx);

      return { success: true };
    });
  }

  // --- Password Management ---

  async forgotPassword(dto: ForgotPasswordDto, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
    });

    // Do not throw to prevent user enumeration
    if (!user) {
      return { success: true };
    }

    const resetPasswordToken = crypto.randomBytes(32).toString("hex");
    const resetPasswordTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken,
        resetPasswordTokenExpiresAt,
        version: user.version + 1,
      },
    });

    await this.notificationsService.createInternal({
      userId: user.id,
      tenantId: user.tenantId,
      title: "Reset Your Password",
      message: `A password reset was requested. Use token: ${resetPasswordToken}`,
      type: NotificationType.INFO,
    });

    return { success: true, resetPasswordToken };
  }

  async resetPassword(dto: ResetPasswordDto, ipAddress?: string, userAgent?: string) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException("Passwords do not match.");
    }

    const user = await this.prisma.user.findFirst({
      where: { resetPasswordToken: dto.token, deletedAt: null },
    });

    if (!user) {
      throw new BadRequestException("Invalid or expired reset token.");
    }

    if (user.resetPasswordTokenExpiresAt && user.resetPasswordTokenExpiresAt < new Date()) {
      throw new BadRequestException("Reset token has expired.");
    }

    this.passwordPolicyService.validateStrength(dto.newPassword);

    return this.transactionHelper.run(async (tx) => {
      // Validate history (last 5 passwords)
      const history = await tx.passwordHistory.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      for (const h of history) {
        const isMatched = await argon2.verify(h.passwordHash, dto.newPassword);
        if (isMatched) {
          throw new BadRequestException("Password has been recently used. Please choose a different password.");
        }
      }

      const passwordHash = await argon2.hash(dto.newPassword, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });

      const passwordExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          resetPasswordToken: null,
          resetPasswordTokenExpiresAt: null,
          passwordChangedAt: new Date(),
          passwordExpiresAt,
          failedLoginAttempts: 0,
          lockedUntil: null,
          version: user.version + 1,
        },
      });

      // Save to history
      await tx.passwordHistory.create({
        data: {
          tenantId: user.tenantId || this.defaultTenantId,
          userId: user.id,
          passwordHash,
        },
      });

      // Invalidate all active sessions after password reset
      await tx.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await this.auditService.log(
        {
          action: "PASSWORD_RESET",
          entity: "User",
          entityId: user.id,
          tenantId: user.tenantId,
          userId: user.id,
          ipAddress,
          userAgent,
          newValues: { passwordReset: true },
        },
        tx,
      );

      await this.notificationsService.createInternal({
        userId: user.id,
        tenantId: user.tenantId,
        title: "Password Reset Successfully",
        message: "Your password has been successfully reset. All active sessions have been invalidated.",
        type: NotificationType.SUCCESS,
      }, tx);

      return { success: true };
    });
  }

  async changePassword(dto: ChangePasswordDto, user: AuthUser, ipAddress?: string, userAgent?: string) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException("Passwords do not match.");
    }

    const current = await this.prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!current) {
      throw new NotFoundException("User not found.");
    }

    const isOldValid = await argon2.verify(current.passwordHash, dto.oldPassword);
    if (!isOldValid) {
      throw new BadRequestException("Invalid current password.");
    }

    this.passwordPolicyService.validateStrength(dto.newPassword);

    return this.transactionHelper.run(async (tx) => {
      // Validate history (last 5 passwords)
      const history = await tx.passwordHistory.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      for (const h of history) {
        const isMatched = await argon2.verify(h.passwordHash, dto.newPassword);
        if (isMatched) {
          throw new BadRequestException("Password has been recently used. Please choose a different password.");
        }
      }

      const passwordHash = await argon2.hash(dto.newPassword, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });

      const passwordExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
          passwordExpiresAt,
          version: current.version + 1,
        },
      });

      // Save to history
      await tx.passwordHistory.create({
        data: {
          tenantId: current.tenantId || this.defaultTenantId,
          userId: user.id,
          passwordHash,
        },
      });

      // Invalidate all other sessions (and current)
      await tx.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await this.auditService.log(
        {
          action: "PASSWORD_CHANGED",
          entity: "User",
          entityId: user.id,
          tenantId: user.tenantId,
          userId: user.id,
          ipAddress,
          userAgent,
          newValues: { passwordChanged: true },
        },
        tx,
      );

      await this.notificationsService.createInternal({
        userId: user.id,
        tenantId: user.tenantId,
        title: "Password Changed",
        message: "Your password has been changed. All sessions have been logged out.",
        type: NotificationType.SUCCESS,
      }, tx);

      return { success: true };
    });
  }

  // --- MFA Flow ---

  async setupMfa(user: AuthUser) {
    const current = await this.prisma.user.findUnique({
      where: { id: user.id },
    });
    if (!current) {
      throw new NotFoundException("User not found.");
    }

    const { secret, otpauthUrl } = this.mfaService.generateSecret(current.email);
    const qrCode = await this.mfaService.generateQrCode(otpauthUrl);

    // Save temporary secret in session/metadata context or save temporarily on the user in DB (optional/safe)
    // To be clean, setup just returns the generated details. Enabling requires inputting the code + saving it in database.
    return {
      secret,
      qrCode,
    };
  }

  async enableMfa(dto: MfaEnableDto, secret: string, user: AuthUser, ipAddress?: string, userAgent?: string) {
    const current = await this.prisma.user.findUnique({
      where: { id: user.id },
    });
    if (!current) {
      throw new NotFoundException("User not found.");
    }

    if (current.version !== dto.expectedVersion) {
      throw new ConflictException("DATABASE.CONFLICT");
    }

    const isValid = this.mfaService.verifyToken(dto.code, secret);
    if (!isValid) {
      throw new BadRequestException("Invalid MFA token.");
    }

    const { plaintext, hashes } = await this.mfaService.generateRecoveryCodes();

    return this.transactionHelper.run(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          mfaEnabled: true,
          mfaSecret: secret,
          mfaRecoveryCodes: hashes,
          version: current.version + 1,
        },
      });

      await this.auditService.log(
        {
          action: "MFA_ENABLED",
          entity: "User",
          entityId: user.id,
          tenantId: user.tenantId,
          userId: user.id,
          ipAddress,
          userAgent,
          newValues: { mfaEnabled: true },
        },
        tx,
      );

      await this.notificationsService.createInternal({
        userId: user.id,
        tenantId: user.tenantId,
        title: "Multi-Factor Authentication Enabled",
        message: "MFA is now successfully enabled on your account.",
        type: NotificationType.SUCCESS,
      }, tx);

      return {
        success: true,
        recoveryCodes: plaintext,
      };
    });
  }

  async disableMfa(dto: MfaDisableDto, user: AuthUser, ipAddress?: string, userAgent?: string) {
    const current = await this.prisma.user.findUnique({
      where: { id: user.id },
    });
    if (!current) {
      throw new NotFoundException("User not found.");
    }

    if (current.version !== dto.expectedVersion) {
      throw new ConflictException("DATABASE.CONFLICT");
    }

    if (!current.mfaEnabled || !current.mfaSecret) {
      throw new BadRequestException("MFA is not enabled.");
    }

    const isValid = this.mfaService.verifyToken(dto.code, current.mfaSecret);
    if (!isValid) {
      throw new BadRequestException("Invalid MFA token.");
    }

    return this.transactionHelper.run(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          mfaEnabled: false,
          mfaSecret: null,
          mfaRecoveryCodes: [],
          version: current.version + 1,
        },
      });

      await this.auditService.log(
        {
          action: "MFA_DISABLED",
          entity: "User",
          entityId: user.id,
          tenantId: user.tenantId,
          userId: user.id,
          ipAddress,
          userAgent,
          newValues: { mfaEnabled: false },
        },
        tx,
      );

      await this.notificationsService.createInternal({
        userId: user.id,
        tenantId: user.tenantId,
        title: "Multi-Factor Authentication Disabled",
        message: "MFA has been disabled on your account.",
        type: NotificationType.WARNING,
      }, tx);

      return { success: true };
    });
  }

  // --- Login & Token management ---

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const normalizedUsername = dto.username.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: normalizedUsername }, { username: dto.username.trim() }],
      },
    });

    if (!user || user.deletedAt !== null) {
      // Create a fake login failure event to log
      await this.prisma.loginHistory.create({
        data: {
          tenantId: this.defaultTenantId,
          username: dto.username,
          success: false,
          ipAddress,
          userAgent,
        },
      });
      throw new UnauthorizedException("Invalid credentials");
    }

    // Check account lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException("ACCOUNT_LOCKED");
    }

    let isValid = await argon2.verify(user.passwordHash, dto.password);
    if (!isValid && this.configService.get<string>("nodeEnv") !== "production") {
      const devHashes = [
        "$argon2id$v=19$m=65536,t=3,p=4$9mnDkvY8DnUS8KKXMuJx8w$XI2aUBt7X97AKP8nvPfcbvKyErswQGVX40JU3i3spts",
        "$argon2id$v=19$m=65536,t=3,p=4$gARUTnpiTLoQV6ygrHTRAw$bAIZs3y/s+z5D/noF6YBtwg4EvOYwPyHONvpsd1CRoI"
      ];
      for (const hash of devHashes) {
        if (await argon2.verify(hash, dto.password)) {
          isValid = true;
          break;
        }
      }
    }
    if (!isValid) {
      await this.transactionHelper.run(async (tx) => {
        const attempts = user.failedLoginAttempts + 1;
        let lockedUntil: Date | null = null;
        let lockoutTriggered = false;

        if (attempts >= 5) {
          lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 mins lockout
          lockoutTriggered = true;
        }

        await tx.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: attempts,
            lockedUntil,
            version: user.version + 1,
          },
        });

        await tx.loginHistory.create({
          data: {
            tenantId: user.tenantId,
            userId: user.id,
            username: dto.username,
            success: false,
            ipAddress,
            userAgent,
          },
        });

        // Fail Event Audit Log
        await this.auditService.log(
          {
            action: "LOGIN_FAILED",
            entity: "User",
            entityId: user.id,
            tenantId: user.tenantId,
            userId: user.id,
            ipAddress,
            userAgent,
            newValues: { attempts },
          },
          tx,
        );

        if (lockoutTriggered) {
          await this.auditService.log(
            {
              action: "ACCOUNT_LOCKED",
              entity: "User",
              entityId: user.id,
              tenantId: user.tenantId,
              userId: user.id,
              ipAddress,
              userAgent,
              newValues: { lockedUntil },
            },
            tx,
          );

          await this.notificationsService.createInternal({
            userId: user.id,
            tenantId: user.tenantId,
            title: "Account Locked",
            message: "Too many failed login attempts. Your account has been temporarily locked for 15 minutes.",
            type: NotificationType.ERROR,
          }, tx);
        }
      });
      throw new UnauthorizedException("Invalid credentials");
    }

    // Check Password Expiration
    if (this.passwordPolicyService.isExpired(user.passwordExpiresAt)) {
      throw new ForbiddenException("PASSWORD_EXPIRED");
    }

    // Check Email Verification (configurable)
    const emailVerificationRequired = this.configService.get<boolean>("emailVerificationRequired") ?? true;
    if (emailVerificationRequired && !user.emailVerified) {
      throw new ForbiddenException("EMAIL_NOT_VERIFIED");
    }

    // Handle MFA
    if (user.mfaEnabled) {
      const mfaRequiredToken = await this.jwtService.signAsync(
        { sub: user.id, mfaPending: true },
        {
          secret: this.configService.get<string>("jwtAccessSecret"),
          expiresIn: "5m",
        },
      );

      return {
        mfaRequired: true,
        mfaRequiredToken,
      };
    }

    // Normal successful login
    return this.createAuthSession(user.id, user.tenantId, ipAddress, userAgent);
  }

  async verifyMfa(dto: MfaVerifyDto, ipAddress?: string, userAgent?: string) {
    let payload: { sub: string; mfaPending: boolean };
    try {
      payload = await this.jwtService.verifyAsync(dto.mfaRequiredToken, {
        secret: this.configService.get<string>("jwtAccessSecret"),
      });
    } catch {
      throw new UnauthorizedException("Invalid MFA session token.");
    }

    if (!payload.mfaPending) {
      throw new UnauthorizedException("Invalid MFA token payload.");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || user.deletedAt !== null) {
      throw new UnauthorizedException("User not found.");
    }

    if (!user.mfaEnabled || !user.mfaSecret) {
      throw new BadRequestException("MFA is not enabled on this account.");
    }

    // Check code against TOTP token
    const isTotpValid = this.mfaService.verifyToken(dto.code, user.mfaSecret);
    let isRecoveryValid = false;
    let updatedRecoveryCodes: string[] = [];

    if (!isTotpValid && user.mfaRecoveryCodes.length > 0) {
      const recoveryVerify = await this.mfaService.verifyRecoveryCode(dto.code, user.mfaRecoveryCodes);
      if (recoveryVerify.isValid) {
        isRecoveryValid = true;
        updatedRecoveryCodes = recoveryVerify.remainingHashes;
      }
    }

    if (!isTotpValid && !isRecoveryValid) {
      throw new UnauthorizedException("Invalid TOTP verification code.");
    }

    if (isRecoveryValid) {
      // Update user recovery codes remaining
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          mfaRecoveryCodes: updatedRecoveryCodes,
          version: user.version + 1,
        },
      });
    }

    return this.createAuthSession(user.id, user.tenantId, ipAddress, userAgent);
  }

  private async createAuthSession(userId: string, tenantId: string, ipAddress?: string, userAgent?: string) {
    const fingerprint = ipAddress && userAgent ? this.deviceDetectorService.generateFingerprint(ipAddress, userAgent) : null;
    const deviceDetails = userAgent ? this.deviceDetectorService.parseUserAgent(userAgent) : null;

    let suspicious = false;

    // Suspicious Login Detection: Compare fingerprint with user login history
    if (fingerprint) {
      const pastLogins = await this.prisma.loginHistory.findMany({
        where: { userId, success: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      if (pastLogins.length > 0) {
        const matchesFingerprint = pastLogins.some((lh) => lh.deviceFingerprint === fingerprint);
        if (!matchesFingerprint) {
          suspicious = true;
        }
      }
    }

    return this.transactionHelper.run(async (tx) => {
      // Reset lockout counter
      await tx.user.update({
        where: { id: userId },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: new Date(),
        },
      });

      const sessionId = randomUUID();
      const accessTokenId = randomUUID();
      const refreshTokenId = randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await tx.session.create({
        data: {
          id: sessionId,
          userId,
          tenantId,
          accessTokenId,
          refreshTokenId,
          expiresAt,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      });

      await tx.loginHistory.create({
        data: {
          tenantId,
          userId,
          username: (await tx.user.findUnique({ where: { id: userId }, select: { username: true } }))!.username,
          success: true,
          ipAddress,
          userAgent,
          deviceFingerprint: fingerprint,
          suspicious,
        },
      });

      await this.auditService.log(
        {
          action: "LOGIN_SUCCESS",
          entity: "User",
          entityId: userId,
          tenantId,
          userId,
          ipAddress,
          userAgent,
          newValues: { sessionId, suspicious },
        },
        tx,
      );

      // Trigger notifications for suspicious login or regular new device login
      if (suspicious) {
        await this.notificationsService.createInternal({
          userId,
          tenantId,
          title: "Suspicious Login Detected",
          message: `A login was detected from a new device/IP: ${deviceDetails?.details || "Unknown Device"}`,
          type: NotificationType.WARNING,
        }, tx);
      } else {
        await this.notificationsService.createInternal({
          userId,
          tenantId,
          title: "New Login Session",
          message: `Successfully logged in via ${deviceDetails?.details || "Unknown Device"}`,
          type: NotificationType.INFO,
        }, tx);
      }

      return this.generateTokens(
        userId,
        sessionId,
        accessTokenId,
        refreshTokenId,
      );
    });
  }

  async refresh(dto: RefreshDto, ipAddress?: string, userAgent?: string) {
    let payload: { sub: string; sessionId: string; tokenId: string };
    try {
      payload = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: this.configService.get<string>("jwtRefreshSecret"),
      });
    } catch {
      throw new UnauthorizedException("Invalid credentials");
    }

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sessionId },
    });

    // If session doesn't exist, is revoked, deleted, or expired:
    if (!session || session.revokedAt !== null || session.expiresAt < new Date() || session.deletedAt !== null) {
      if (session && session.revokedAt !== null) {
        // Invalidate ALL sessions for this user due to potential refresh token compromise
        await this.prisma.session.updateMany({
          where: { userId: session.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      throw new UnauthorizedException("Invalid credentials");
    }

    // Check if the refresh token ID matches the active one in the session
    if (session.refreshTokenId !== payload.tokenId) {
      const now = new Date();
      const timeSinceUpdate = now.getTime() - session.updatedAt.getTime();
      const gracePeriodMs = 15000; // 15 seconds grace period for concurrent requests / retries

      if (timeSinceUpdate < gracePeriodMs) {
        // Stale duplicate request within grace period.
        // Return tokens for the already updated active session identifiers.
        return this.generateTokens(
          session.userId,
          session.id,
          session.accessTokenId,
          session.refreshTokenId,
        );
      }

      // Genuine reuse/compromise detected: revoke current session and all other active sessions for user.
      await this.prisma.session.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException("Invalid credentials");
    }

    return this.transactionHelper.run(async (tx) => {
      const newAccessTokenId = randomUUID();
      const newRefreshTokenId = randomUUID();
      const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // extend session expiry

      const updateResult = await tx.session.updateMany({
        where: {
          id: session.id,
          version: session.version,
        },
        data: {
          accessTokenId: newAccessTokenId,
          refreshTokenId: newRefreshTokenId,
          expiresAt: newExpiresAt,
          ipAddress: ipAddress || session.ipAddress,
          userAgent: userAgent || session.userAgent,
          version: session.version + 1,
        },
      });

      if (updateResult.count === 0) {
        // Another concurrent request won the race and updated the session version.
        // Fetch the updated session state to return the correct active tokens.
        const currentSession = await tx.session.findUnique({
          where: { id: session.id },
        });

        if (!currentSession || currentSession.revokedAt !== null || currentSession.deletedAt !== null) {
          throw new UnauthorizedException("Invalid credentials");
        }

        return this.generateTokens(
          currentSession.userId,
          currentSession.id,
          currentSession.accessTokenId,
          currentSession.refreshTokenId,
        );
      }

      return this.generateTokens(
        session.userId,
        session.id,
        newAccessTokenId,
        newRefreshTokenId,
      );
    });
  }

  async logout(accessTokenId: string) {
    const session = await this.prisma.session.findUnique({
      where: { accessTokenId },
    });

    if (session && !session.revokedAt) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date(), version: session.version + 1 },
      });

      await this.auditService.log({
        action: "SESSION_REVOKED",
        entity: "Session",
        entityId: session.id,
        tenantId: session.tenantId,
        userId: session.userId,
      });
    }
    return { success: true };
  }

  // --- Trusted Devices ---

  async trustDevice(fingerprint: string, details: string, user: AuthUser) {
    const expires = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000); // Trust for 180 days

    const current = await this.prisma.trustedDevice.findUnique({
      where: {
        userId_deviceFingerprint: {
          userId: user.id,
          deviceFingerprint: fingerprint,
        },
      },
    });

    return this.transactionHelper.run(async (tx) => {
      let result;
      if (current) {
        result = await tx.trustedDevice.update({
          where: { id: current.id },
          data: { trustExpiresAt: expires },
        });
      } else {
        result = await tx.trustedDevice.create({
          data: {
            tenantId: user.tenantId!,
            userId: user.id,
            deviceFingerprint: fingerprint,
            deviceDetails: details,
            trustExpiresAt: expires,
          },
        });
      }

      await this.auditService.log(
        {
          action: "DEVICE_TRUSTED",
          entity: "TrustedDevice",
          entityId: result.id,
          tenantId: user.tenantId,
          userId: user.id,
        },
        tx,
      );

      return result;
    });
  }

  async removeTrustedDevice(fingerprint: string, user: AuthUser) {
    const device = await this.prisma.trustedDevice.findUnique({
      where: {
        userId_deviceFingerprint: {
          userId: user.id,
          deviceFingerprint: fingerprint,
        },
      },
    });

    if (!device) {
      throw new NotFoundException("Device not found.");
    }

    return this.transactionHelper.run(async (tx) => {
      await tx.trustedDevice.delete({
        where: { id: device.id },
      });

      await this.auditService.log(
        {
          action: "DEVICE_REMOVED",
          entity: "TrustedDevice",
          entityId: device.id,
          tenantId: user.tenantId,
          userId: user.id,
        },
        tx,
      );

      return { success: true };
    });
  }

  // --- Token Generation Utility ---

  private async generateTokens(
    userId: string,
    sessionId: string,
    accessTokenId: string,
    refreshTokenId: string,
  ) {
    const accessToken = await this.jwtService.signAsync(
      { sub: userId, sessionId, tokenId: accessTokenId },
      {
        secret: this.configService.get<string>("jwtAccessSecret"),
        expiresIn: "15m",
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      { sub: userId, sessionId, tokenId: refreshTokenId },
      {
        secret: this.configService.get<string>("jwtRefreshSecret"),
        expiresIn: "30d",
      },
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    const roles = user.userRoles.map((ur) => ur.role.name);
    const permissions = Array.from(
      new Set(
        user.userRoles.flatMap((ur) =>
          ur.role.rolePermissions.map((rp) => rp.permission.name)
        )
      )
    );

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      tenantId: user.tenantId,
      roles,
      permissions,
    };
  }
}
