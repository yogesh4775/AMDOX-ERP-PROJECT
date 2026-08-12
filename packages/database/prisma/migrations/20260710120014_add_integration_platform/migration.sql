-- CreateTable
CREATE TABLE "integration_api_keys" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "key_prefix" VARCHAR(50) NOT NULL,
    "hashed_key" VARCHAR(255) NOT NULL,
    "scopes" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMPTZ,
    "rate_limit_tps" INTEGER NOT NULL DEFAULT 10,
    "daily_quota_limit" INTEGER NOT NULL DEFAULT 10000,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "integration_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_webhook_endpoints" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "url" VARCHAR(512) NOT NULL,
    "secret" VARCHAR(255) NOT NULL,
    "events" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "integration_webhook_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_webhook_deliveries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "endpoint_id" UUID NOT NULL,
    "event" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "response_status_code" INTEGER,
    "response_body" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_configs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "provider" VARCHAR(100) NOT NULL,
    "credentials" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "integration_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_api_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "api_key_id" UUID,
    "method" VARCHAR(10) NOT NULL,
    "path" VARCHAR(255) NOT NULL,
    "status_code" INTEGER NOT NULL,
    "response_time_ms" INTEGER NOT NULL,
    "ip_address" VARCHAR(50),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_api_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "integration_api_keys_tenant_id_idx" ON "integration_api_keys"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "integration_api_keys_tenant_id_hashed_key_key" ON "integration_api_keys"("tenant_id", "hashed_key");

-- CreateIndex
CREATE INDEX "integration_webhook_endpoints_tenant_id_idx" ON "integration_webhook_endpoints"("tenant_id");

-- CreateIndex
CREATE INDEX "integration_webhook_deliveries_tenant_id_status_idx" ON "integration_webhook_deliveries"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "integration_configs_tenant_id_idx" ON "integration_configs"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "integration_configs_tenant_id_provider_key" ON "integration_configs"("tenant_id", "provider");

-- CreateIndex
CREATE INDEX "integration_api_logs_tenant_id_created_at_idx" ON "integration_api_logs"("tenant_id", "created_at");

-- AddForeignKey
ALTER TABLE "integration_webhook_deliveries" ADD CONSTRAINT "integration_webhook_deliveries_endpoint_id_fkey" FOREIGN KEY ("endpoint_id") REFERENCES "integration_webhook_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_api_logs" ADD CONSTRAINT "integration_api_logs_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "integration_api_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;
