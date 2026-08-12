import * as Joi from "joi";

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid("development", "production", "test")
    .default("development"),
  PORT: Joi.number().port().default(3001),
  DATABASE_URL: Joi.string().required(),
  CORS_ORIGINS: Joi.string().required(),
  LOG_LEVEL: Joi.string()
    .valid("error", "warn", "log", "info", "debug", "verbose")
    .default("info"),
  TRUST_PROXY: Joi.boolean().default(false),
  JWT_ACCESS_SECRET: Joi.string().required(),
  JWT_REFRESH_SECRET: Joi.string().required(),
  UPLOAD_DIRECTORY: Joi.string().default("uploads"),
  UPLOAD_MAX_SIZE: Joi.number().default(10485760),
  ALLOWED_MIME_TYPES: Joi.string().default(
    "image/jpeg,image/png,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/zip,application/x-zip-compressed,text/csv",
  ),
});
