-- CreateTable
CREATE TABLE "ai_model_registry" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "version" VARCHAR(50) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "algorithm" VARCHAR(100) NOT NULL,
    "metrics" JSONB NOT NULL,
    "hyperparameters" JSONB NOT NULL,
    "model_binary" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "training_job_id" UUID,

    CONSTRAINT "ai_model_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_feature_store" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" UUID NOT NULL,
    "feature_group" VARCHAR(100) NOT NULL,
    "features" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_feature_store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_training_jobs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "model_name" VARCHAR(100) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "logs" TEXT,
    "error_message" TEXT,
    "metrics" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_training_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_prediction_history" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "model_name" VARCHAR(100) NOT NULL,
    "model_version" VARCHAR(50) NOT NULL,
    "input_data" JSONB NOT NULL,
    "predicted_value" JSONB NOT NULL,
    "actual_value" JSONB,
    "contributions" JSONB,
    "is_anomaly" BOOLEAN NOT NULL DEFAULT false,
    "confidence_score" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_prediction_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_recommendations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "target_type" VARCHAR(100) NOT NULL,
    "target_entity_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "recommendation" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "is_applied" BOOLEAN NOT NULL DEFAULT false,
    "applied_at" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_anomaly_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "source" VARCHAR(100) NOT NULL,
    "severity" VARCHAR(50) NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_anomaly_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_model_registry_tenant_id_idx" ON "ai_model_registry"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_model_registry_tenant_id_name_version_key" ON "ai_model_registry"("tenant_id", "name", "version");

-- CreateIndex
CREATE INDEX "ai_feature_store_tenant_id_idx" ON "ai_feature_store"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_feature_store_tenant_id_entity_type_entity_id_feature_gr_key" ON "ai_feature_store"("tenant_id", "entity_type", "entity_id", "feature_group");

-- CreateIndex
CREATE INDEX "ai_training_jobs_tenant_id_idx" ON "ai_training_jobs"("tenant_id");

-- CreateIndex
CREATE INDEX "ai_prediction_history_tenant_id_model_name_idx" ON "ai_prediction_history"("tenant_id", "model_name");

-- CreateIndex
CREATE INDEX "ai_recommendations_tenant_id_idx" ON "ai_recommendations"("tenant_id");

-- CreateIndex
CREATE INDEX "ai_anomaly_events_tenant_id_idx" ON "ai_anomaly_events"("tenant_id");

-- AddForeignKey
ALTER TABLE "ai_model_registry" ADD CONSTRAINT "ai_model_registry_training_job_id_fkey" FOREIGN KEY ("training_job_id") REFERENCES "ai_training_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
