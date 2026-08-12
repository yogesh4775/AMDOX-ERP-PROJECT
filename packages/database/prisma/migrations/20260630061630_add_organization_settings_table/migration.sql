-- CreateTable
CREATE TABLE "organization_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_name" VARCHAR(255),
    "legal_name" VARCHAR(255),
    "logo_url" VARCHAR(2048),
    "website" VARCHAR(255),
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "tax_number" VARCHAR(50),
    "currency" VARCHAR(10),
    "timezone" VARCHAR(100),
    "fiscal_year_start" VARCHAR(50),
    "address" TEXT,
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "postal_code" VARCHAR(20),
    "country" VARCHAR(100),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "organization_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_settings_tenant_id_key" ON "organization_settings"("tenant_id");

-- CreateIndex
CREATE INDEX "organization_settings_tenant_id_idx" ON "organization_settings"("tenant_id");

-- AddForeignKey
ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
