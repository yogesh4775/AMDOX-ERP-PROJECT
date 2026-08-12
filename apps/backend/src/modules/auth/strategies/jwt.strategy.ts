import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "@amdox/database";
import { AuthUser } from "../interfaces/auth-user.interface";
import { requestContextStorage } from "../../../common/audit/request-context-storage";

interface JwtPayload {
  sub: string;
  sessionId: string;
  tokenId: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("jwtAccessSecret")!,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    // Check whether the session associated with the access token
    // still exists and is active.
    const session = await this.prisma.session.findUnique({
      where: {
        id: payload.sessionId,
      },
    });

    if (
      !session ||
      session.revokedAt !== null ||
      session.deletedAt !== null ||
      session.expiresAt < new Date()
    ) {
      throw new UnauthorizedException("Invalid credentials");
    }

    // Store authentication information in the request context
    // for auditing and downstream services.
    const context = requestContextStorage.getStore();

    if (context) {
      context.userId = payload.sub;
      context.sessionId = payload.sessionId;
      context.tenantId = session.tenantId;
    }

    return {
      id: payload.sub,
      sessionId: payload.sessionId,
      tokenId: payload.tokenId,
      tenantId: session.tenantId,
    };
  }
}