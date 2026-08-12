import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { AuditService } from "./audit.service";
import { requestContextStorage } from "./request-context-storage";
import { Request } from "express";

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger("AuditInterceptor");

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse();
    const method = req.method;
    const path = (req.route?.path as string) || req.url;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = res.statusCode || HttpStatus.OK;
          this.logRequest(req, statusCode, duration, path, method);
        },
        error: (err: { status?: number }) => {
          const duration = Date.now() - startTime;
          const statusCode = err.status || HttpStatus.INTERNAL_SERVER_ERROR;
          this.logRequest(req, statusCode, duration, path, method);
        },
      }),
    );
  }

  private logRequest(
    req: Request,
    statusCode: number,
    duration: number,
    path: string,
    method: string,
  ) {
    const context = requestContextStorage.getStore();

    if (!context) return;

    this.auditService
      .log({
        action: "HTTP_REQUEST",
        entity: "HttpRequest",
        entityId: path,
        newValues: {
          method,
          route: path,
          statusCode,
          durationMs: duration,
        },
        requestId: context.requestId,
        userId: context.userId,
        tenantId: context.tenantId,
        ipAddress: context.ip,
        userAgent: context.userAgent,
      })
      .catch((err: Error) => {
        this.logger.error(
          `Failed to write HTTP Request audit log: ${err.message}`,
        );
      });
  }
}
