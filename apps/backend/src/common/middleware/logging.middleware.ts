import { Injectable, NestMiddleware, Logger } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { requestContextStorage } from "../audit/request-context-storage";
import { RequestContext } from "../types/request-context.interface";

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HTTP");

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl } = req;
    const startTime = Date.now();

    // Retrieve or generate requestId
    let requestId =
      (req.headers["x-request-id"] as string) ||
      ((req as unknown as Record<string, unknown>).requestId as string);

    if (!requestId) {
      requestId = randomUUID();
      (req as unknown as Record<string, unknown>).requestId = requestId;
    }

    // Set on response headers
    res.setHeader("x-request-id", String(requestId));

    const context: RequestContext = {
      requestId,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: (req.headers["user-agent"] as string) || undefined,
      requestStartTime: startTime,
      route: req.route?.path || originalUrl,
      method,
    };

    res.on("finish", () => {
      const { statusCode } = res;
      const duration = Date.now() - startTime;
      this.logger.log(
        `[${requestId}] ${method} ${originalUrl} ${statusCode} - ${duration}ms`,
      );
    });

    requestContextStorage.run(context, () => {
      next();
    });
  }
}
