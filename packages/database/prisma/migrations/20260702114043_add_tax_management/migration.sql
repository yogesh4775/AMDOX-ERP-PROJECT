-- CreateEnum
CREATE TYPE "ExemptionEntityType" AS ENUM ('CUSTOMER', 'SUPPLIER', 'PRODUCT');

-- CreateEnum
CREATE TYPE "TaxTransactionSourceType" AS ENUM ('INVOICE', 'PURCHASE', 'SALES');

-- CreateTable
CREATE TABLE "tax_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "tax_category_id" UUID NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "jurisdiction" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "tax_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_exemptions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "entity_type" "ExemptionEntityType" NOT NULL,
    "entity_id" UUID NOT NULL,
    "tax_rule_id" UUID NOT NULL,
    "reason" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "tax_exemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_transactions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "source_type" "TaxTransactionSourceType" NOT NULL,
    "source_id" UUID NOT NULL,
    "tax_rule_id" UUID NOT NULL,
    "base_amount" DECIMAL(12,4) NOT NULL,
    "tax_amount" DECIMAL(12,4) NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tax_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tax_rules_tenant_id_idx" ON "tax_rules"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tax_rules_tenant_id_name_key" ON "tax_rules"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "tax_exemptions_tenant_id_idx" ON "tax_exemptions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tax_exemptions_tenant_id_name_key" ON "tax_exemptions"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "tax_transactions_tenant_id_idx" ON "tax_transactions"("tenant_id");

-- CreateIndex
CREATE INDEX "tax_transactions_source_id_idx" ON "tax_transactions"("source_id");

-- AddForeignKey
ALTER TABLE "tax_rules" ADD CONSTRAINT "tax_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_rules" ADD CONSTRAINT "tax_rules_tax_category_id_fkey" FOREIGN KEY ("tax_category_id") REFERENCES "tax_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_exemptions" ADD CONSTRAINT "tax_exemptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_exemptions" ADD CONSTRAINT "tax_exemptions_tax_rule_id_fkey" FOREIGN KEY ("tax_rule_id") REFERENCES "tax_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_transactions" ADD CONSTRAINT "tax_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_transactions" ADD CONSTRAINT "tax_transactions_tax_rule_id_fkey" FOREIGN KEY ("tax_rule_id") REFERENCES "tax_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
