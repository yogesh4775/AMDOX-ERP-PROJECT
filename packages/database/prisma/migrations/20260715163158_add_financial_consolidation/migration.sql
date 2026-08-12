-- CreateEnum
CREATE TYPE "InterCompanyType" AS ENUM ('SALE_PURCHASE', 'INVENTORY_TRANSFER', 'SETTLEMENT', 'FUNDS_TRANSFER');

-- CreateEnum
CREATE TYPE "InterCompanyStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SETTLED');

-- CreateEnum
CREATE TYPE "ConsolidationStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ConsolidatedReportType" AS ENUM ('BALANCE_SHEET', 'PROFIT_AND_LOSS', 'CASH_FLOW');

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "company_id" UUID;

-- AlterTable
ALTER TABLE "journal_entries" ADD COLUMN     "company_id" UUID;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "company_id" UUID;

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "company_id" UUID;

-- AlterTable
ALTER TABLE "sales_orders" ADD COLUMN     "company_id" UUID;

-- AlterTable
ALTER TABLE "warehouses" ADD COLUMN     "company_id" UUID;

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "parent_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "legal_name" VARCHAR(255) NOT NULL,
    "tax_id" VARCHAR(100),
    "base_currency" VARCHAR(10) NOT NULL,
    "country" VARCHAR(100) NOT NULL,
    "is_consolidation_entity" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "from_currency" VARCHAR(10) NOT NULL,
    "to_currency" VARCHAR(10) NOT NULL,
    "rate" DECIMAL(18,6) NOT NULL,
    "rate_date" TIMESTAMPTZ NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inter_company_transactions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "from_company_id" UUID NOT NULL,
    "to_company_id" UUID NOT NULL,
    "type" "InterCompanyType" NOT NULL,
    "status" "InterCompanyStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(12,4) NOT NULL,
    "currency" VARCHAR(10) NOT NULL,
    "reference_type" VARCHAR(100),
    "reference_id" UUID,
    "eliminated" BOOLEAN NOT NULL DEFAULT false,
    "elimination_id" UUID,
    "transfer_pricing_markup" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "inter_company_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consolidation_runs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "parent_company_id" UUID NOT NULL,
    "start_date" TIMESTAMPTZ NOT NULL,
    "end_date" TIMESTAMPTZ NOT NULL,
    "status" "ConsolidationStatus" NOT NULL DEFAULT 'PENDING',
    "run_by" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "consolidation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consolidated_reports" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "consolidation_run_id" UUID NOT NULL,
    "report_type" "ConsolidatedReportType" NOT NULL,
    "period_name" VARCHAR(100) NOT NULL,
    "currency" VARCHAR(10) NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consolidated_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_permissions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "companies_tenant_id_idx" ON "companies"("tenant_id");

-- CreateIndex
CREATE INDEX "companies_parent_id_idx" ON "companies"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "companies_tenant_id_code_key" ON "companies"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "exchange_rates_tenant_id_idx" ON "exchange_rates"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_tenant_id_from_currency_to_currency_rate_dat_key" ON "exchange_rates"("tenant_id", "from_currency", "to_currency", "rate_date");

-- CreateIndex
CREATE INDEX "inter_company_transactions_tenant_id_idx" ON "inter_company_transactions"("tenant_id");

-- CreateIndex
CREATE INDEX "inter_company_transactions_from_company_id_idx" ON "inter_company_transactions"("from_company_id");

-- CreateIndex
CREATE INDEX "inter_company_transactions_to_company_id_idx" ON "inter_company_transactions"("to_company_id");

-- CreateIndex
CREATE INDEX "consolidation_runs_tenant_id_idx" ON "consolidation_runs"("tenant_id");

-- CreateIndex
CREATE INDEX "consolidated_reports_tenant_id_idx" ON "consolidated_reports"("tenant_id");

-- CreateIndex
CREATE INDEX "company_permissions_tenant_id_idx" ON "company_permissions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_permissions_tenant_id_user_id_company_id_role_id_key" ON "company_permissions"("tenant_id", "user_id", "company_id", "role_id");

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inter_company_transactions" ADD CONSTRAINT "inter_company_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inter_company_transactions" ADD CONSTRAINT "inter_company_transactions_from_company_id_fkey" FOREIGN KEY ("from_company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inter_company_transactions" ADD CONSTRAINT "inter_company_transactions_to_company_id_fkey" FOREIGN KEY ("to_company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consolidation_runs" ADD CONSTRAINT "consolidation_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consolidation_runs" ADD CONSTRAINT "consolidation_runs_parent_company_id_fkey" FOREIGN KEY ("parent_company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consolidated_reports" ADD CONSTRAINT "consolidated_reports_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consolidated_reports" ADD CONSTRAINT "consolidated_reports_consolidation_run_id_fkey" FOREIGN KEY ("consolidation_run_id") REFERENCES "consolidation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_permissions" ADD CONSTRAINT "company_permissions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_permissions" ADD CONSTRAINT "company_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_permissions" ADD CONSTRAINT "company_permissions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
