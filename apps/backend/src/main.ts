import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import compression from "compression";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";

import { Request, Response, NextFunction } from "express";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Disable x-powered-by
  app.disable("x-powered-by");

  // Load config service
  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>("nodeEnv") || "development";
  const isProduction = nodeEnv === "production";
  const port = configService.get<number>("port") || 3001;
  const corsOrigins = configService.get<string[]>("corsOrigins") || [];
  const trustProxy = configService.get<boolean>("trustProxy") || false;

  // Trust proxy if enabled
  if (trustProxy) {
    app.set("trust proxy", 1);
  }

  // Security and compression middleware
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(compression());

  // Intercept and wrap manual res.json responses in standard envelope
  app.use((req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json;
    res.json = function (body: any) {
      if (body && typeof body === "object" && "success" in body) {
        return originalJson.call(this, body);
      }
      const isExcluded = ["/health"].some(
        (path) => req.url === path || req.url.endsWith(path)
      );
      if (isExcluded) {
        return originalJson.call(this, body);
      }
      return originalJson.call(this, {
        success: true,
        data: body ?? null,
        timestamp: new Date().toISOString(),
      });
    };
    next();
  });

  // CORS config
  app.enableCors({
    origin: corsOrigins,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      disableErrorMessages: isProduction,
    }),
  );

  // Global filters & interceptors
  app.useGlobalFilters(new HttpExceptionFilter(configService));
  app.useGlobalInterceptors(new TransformInterceptor());

  // Enable shutdown hooks for graceful exit ( SIGINT, SIGTERM )
  app.enableShutdownHooks();

  // Listen on configured port
  await app.listen(port);
}
bootstrap();
