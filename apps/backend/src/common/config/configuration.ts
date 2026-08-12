export interface AppConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  corsOrigins: string[];
  logLevel: string;
  trustProxy: boolean;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  uploadDirectory: string;
  uploadMaxSize: number;
  allowedMimeTypes: string[];
}

export default () => ({
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3001", 10),
  databaseUrl: process.env.DATABASE_URL,
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim().replace(/^['"]|['"]$/g, ""))
    : [],
  logLevel: process.env.LOG_LEVEL || "info",
  trustProxy: process.env.TRUST_PROXY === "true",
  jwtAccessSecret: (process.env.JWT_ACCESS_SECRET || "").replace(/^['"]|['"]$/g, ""),
  jwtRefreshSecret: (process.env.JWT_REFRESH_SECRET || "").replace(/^['"]|['"]$/g, ""),
  uploadDirectory: process.env.UPLOAD_DIRECTORY || "uploads",
  uploadMaxSize: parseInt(process.env.UPLOAD_MAX_SIZE || "10485760", 10),
  allowedMimeTypes: process.env.ALLOWED_MIME_TYPES
    ? process.env.ALLOWED_MIME_TYPES.split(",").map((m) => m.trim())
    : [
        "image/jpeg",
        "image/png",
        "image/gif",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/zip",
        "application/x-zip-compressed",
        "text/csv",
      ],
});
