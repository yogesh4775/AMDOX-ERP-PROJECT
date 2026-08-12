import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request, Response } from "express";
import { randomUUID } from "crypto";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("ExceptionFilter");

  constructor(private readonly configService: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Generate or retrieve requestId
    let requestId =
      (request.headers["x-request-id"] as string) ||
      ((request as unknown as Record<string, unknown>).requestId as string);

    if (!requestId) {
      requestId = randomUUID();
      (request as unknown as Record<string, unknown>).requestId = requestId;
    }

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const nodeEnv = this.configService.get<string>("nodeEnv") || "development";
    const isProduction = nodeEnv === "production";

    let message = "Internal server error";
    let details: unknown = null;
    let code = "INTERNAL_SERVER_ERROR";

    if (exception instanceof HttpException) {
      const resContent = exception.getResponse();
      message = exception.message;
      code = exception.name || "HTTP_EXCEPTION";
      if (typeof resContent === "object" && resContent !== null) {
        const obj = resContent as Record<string, unknown>;
        message = (obj.message as string) || message;
        code = (obj.error as string) || code;
        details = obj.message !== message ? obj.message : null;
      } else if (typeof resContent === "string") {
        message = resContent;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      details = !isProduction ? exception.stack : null;
    }

    // Log the exception
    this.logger.error(
      `[${requestId}] ${request.method} ${request.url} - Status: ${status} - Error: ${message}`,
      exception instanceof Error && !isProduction ? exception.stack : undefined,
    );

    const errorResponse = {
      success: false,
      error: {
        code,
        message,
        details: details || null,
      },
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId,
    };

    response.status(status).json(errorResponse);
  }
}
