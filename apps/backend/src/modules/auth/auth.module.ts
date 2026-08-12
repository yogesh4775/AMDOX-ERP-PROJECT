import { Module, forwardRef } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "@amdox/database";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { RolesGuard } from "./guards/roles.guard";
import { PermissionsGuard } from "./guards/permissions.guard";
import { AuditModule } from "../../common/audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { SessionsModule } from "../sessions/sessions.module";
import { MfaService } from "./services/mfa.service";
import { PasswordPolicyService } from "./services/password-policy.service";
import { DeviceDetectorService } from "./services/device-detector.service";
import { TransactionHelper } from "../../common/transactions/transaction.helper";

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.register({}),
    PrismaModule,
    AuditModule,
    forwardRef(() => NotificationsModule),
    forwardRef(() => SessionsModule),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    RolesGuard,
    PermissionsGuard,
    MfaService,
    PasswordPolicyService,
    DeviceDetectorService,
    TransactionHelper,
  ],
  exports: [
    AuthService,
    JwtStrategy,
    PassportModule,
    RolesGuard,
    PermissionsGuard,
    MfaService,
    PasswordPolicyService,
    DeviceDetectorService,
    TransactionHelper,
  ],
})
export class AuthModule {}
