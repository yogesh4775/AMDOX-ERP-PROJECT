-- CreateEnum
CREATE TYPE "InspectionPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CharacteristicType" AS ENUM ('QUANTITATIVE', 'QUALITATIVE');

-- CreateEnum
CREATE TYPE "InspectionLotStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'PASSED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InspectionLotType" AS ENUM ('INCOMING', 'IN_PROCESS', 'FINISHED_GOODS', 'CUSTOMER_RETURN');

-- CreateEnum
CREATE TYPE "DefectSeverity" AS ENUM ('CRITICAL', 'MAJOR', 'MINOR');

-- CreateEnum
CREATE TYPE "NCRStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'CAPA_PENDING', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "NCROutcome" AS ENUM ('USE_AS_IS', 'REWORK', 'REGRADE', 'RETURN_TO_SUPPLIER', 'SCRAP');

-- CreateEnum
CREATE TYPE "CAPAType" AS ENUM ('CORRECTIVE', 'PREVENTIVE');

-- CreateEnum
CREATE TYPE "CAPAStatus" AS ENUM ('OPEN', 'INVESTIGATION', 'IMPLEMENTED', 'VERIFIED', 'CLOSED');

-- CreateEnum
CREATE TYPE "COAStatus" AS ENUM ('DRAFT', 'APPROVED', 'REVOKED');

-- CreateTable
CREATE TABLE "sampling_plans" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "aql" DECIMAL(5,2) NOT NULL,
    "lot_size_min" INTEGER NOT NULL,
    "lot_size_max" INTEGER NOT NULL,
    "sample_size" INTEGER NOT NULL,
    "accept_number" INTEGER NOT NULL,
    "reject_number" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "sampling_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_plans" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "status" "InspectionPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "sampling_plan_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "inspection_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_characteristics" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "inspection_plan_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "type" "CharacteristicType" NOT NULL,
    "upper_limit" DECIMAL(18,4),
    "lower_limit" DECIMAL(18,4),
    "unit" VARCHAR(50),
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "inspection_characteristics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_lots" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "product_id" UUID NOT NULL,
    "type" "InspectionLotType" NOT NULL,
    "status" "InspectionLotStatus" NOT NULL DEFAULT 'PENDING',
    "quantity" DECIMAL(18,4) NOT NULL,
    "sample_size" INTEGER NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "purchase_receipt_id" UUID,
    "work_order_id" UUID,
    "inspection_plan_id" UUID,
    "workflow_instance_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "inspection_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_results" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "inspection_lot_id" UUID NOT NULL,
    "characteristic_id" UUID NOT NULL,
    "measured_value" DECIMAL(18,4),
    "passed" BOOLEAN NOT NULL,
    "remarks" TEXT,
    "inspected_by" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "inspection_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_defects" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "inspection_lot_id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "DefectSeverity" NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "quality_defects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "non_conformance_reports" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "inspection_lot_id" UUID,
    "product_id" UUID NOT NULL,
    "source" "InspectionLotType" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "NCRStatus" NOT NULL DEFAULT 'OPEN',
    "action_taken" "NCROutcome",
    "workflow_instance_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "non_conformance_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corrective_actions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "ncr_id" UUID,
    "code" VARCHAR(100) NOT NULL,
    "type" "CAPAType" NOT NULL,
    "description" TEXT NOT NULL,
    "root_cause" TEXT,
    "status" "CAPAStatus" NOT NULL DEFAULT 'OPEN',
    "assigned_to_id" UUID,
    "target_completion_date" TIMESTAMPTZ NOT NULL,
    "actual_completion_date" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "corrective_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_quality_ratings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "supplier_name" VARCHAR(255) NOT NULL,
    "total_receipts" INTEGER NOT NULL,
    "rejected_receipts" INTEGER NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "supplier_quality_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_certificates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "inspection_lot_id" UUID NOT NULL,
    "status" "COAStatus" NOT NULL DEFAULT 'DRAFT',
    "expiry_date" TIMESTAMPTZ,
    "certified_by" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "quality_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sampling_plans_tenant_id_idx" ON "sampling_plans"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "sampling_plans_tenant_id_code_key" ON "sampling_plans"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "inspection_plans_tenant_id_idx" ON "inspection_plans"("tenant_id");

-- CreateIndex
CREATE INDEX "inspection_plans_product_id_idx" ON "inspection_plans"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "inspection_plans_tenant_id_code_key" ON "inspection_plans"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "inspection_characteristics_tenant_id_idx" ON "inspection_characteristics"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "inspection_characteristics_inspection_plan_id_sequence_key" ON "inspection_characteristics"("inspection_plan_id", "sequence");

-- CreateIndex
CREATE INDEX "inspection_lots_tenant_id_idx" ON "inspection_lots"("tenant_id");

-- CreateIndex
CREATE INDEX "inspection_lots_product_id_idx" ON "inspection_lots"("product_id");

-- CreateIndex
CREATE INDEX "inspection_lots_warehouse_id_idx" ON "inspection_lots"("warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "inspection_lots_tenant_id_code_key" ON "inspection_lots"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "inspection_results_tenant_id_idx" ON "inspection_results"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "inspection_results_inspection_lot_id_characteristic_id_key" ON "inspection_results"("inspection_lot_id", "characteristic_id");

-- CreateIndex
CREATE INDEX "quality_defects_tenant_id_idx" ON "quality_defects"("tenant_id");

-- CreateIndex
CREATE INDEX "non_conformance_reports_tenant_id_idx" ON "non_conformance_reports"("tenant_id");

-- CreateIndex
CREATE INDEX "non_conformance_reports_product_id_idx" ON "non_conformance_reports"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "non_conformance_reports_tenant_id_code_key" ON "non_conformance_reports"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "corrective_actions_tenant_id_idx" ON "corrective_actions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "corrective_actions_tenant_id_code_key" ON "corrective_actions"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "supplier_quality_ratings_tenant_id_idx" ON "supplier_quality_ratings"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_quality_ratings_tenant_id_supplier_name_key" ON "supplier_quality_ratings"("tenant_id", "supplier_name");

-- CreateIndex
CREATE INDEX "quality_certificates_tenant_id_idx" ON "quality_certificates"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "quality_certificates_tenant_id_code_key" ON "quality_certificates"("tenant_id", "code");

-- AddForeignKey
ALTER TABLE "sampling_plans" ADD CONSTRAINT "sampling_plans_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_plans" ADD CONSTRAINT "inspection_plans_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_plans" ADD CONSTRAINT "inspection_plans_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_plans" ADD CONSTRAINT "inspection_plans_sampling_plan_id_fkey" FOREIGN KEY ("sampling_plan_id") REFERENCES "sampling_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_characteristics" ADD CONSTRAINT "inspection_characteristics_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_characteristics" ADD CONSTRAINT "inspection_characteristics_inspection_plan_id_fkey" FOREIGN KEY ("inspection_plan_id") REFERENCES "inspection_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_lots" ADD CONSTRAINT "inspection_lots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_lots" ADD CONSTRAINT "inspection_lots_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_lots" ADD CONSTRAINT "inspection_lots_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_lots" ADD CONSTRAINT "inspection_lots_purchase_receipt_id_fkey" FOREIGN KEY ("purchase_receipt_id") REFERENCES "purchase_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_lots" ADD CONSTRAINT "inspection_lots_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_lots" ADD CONSTRAINT "inspection_lots_inspection_plan_id_fkey" FOREIGN KEY ("inspection_plan_id") REFERENCES "inspection_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_results" ADD CONSTRAINT "inspection_results_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_results" ADD CONSTRAINT "inspection_results_inspection_lot_id_fkey" FOREIGN KEY ("inspection_lot_id") REFERENCES "inspection_lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_results" ADD CONSTRAINT "inspection_results_characteristic_id_fkey" FOREIGN KEY ("characteristic_id") REFERENCES "inspection_characteristics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_results" ADD CONSTRAINT "inspection_results_inspected_by_fkey" FOREIGN KEY ("inspected_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_defects" ADD CONSTRAINT "quality_defects_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_defects" ADD CONSTRAINT "quality_defects_inspection_lot_id_fkey" FOREIGN KEY ("inspection_lot_id") REFERENCES "inspection_lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "non_conformance_reports" ADD CONSTRAINT "non_conformance_reports_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "non_conformance_reports" ADD CONSTRAINT "non_conformance_reports_inspection_lot_id_fkey" FOREIGN KEY ("inspection_lot_id") REFERENCES "inspection_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "non_conformance_reports" ADD CONSTRAINT "non_conformance_reports_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrective_actions" ADD CONSTRAINT "corrective_actions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrective_actions" ADD CONSTRAINT "corrective_actions_ncr_id_fkey" FOREIGN KEY ("ncr_id") REFERENCES "non_conformance_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrective_actions" ADD CONSTRAINT "corrective_actions_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_quality_ratings" ADD CONSTRAINT "supplier_quality_ratings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_certificates" ADD CONSTRAINT "quality_certificates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_certificates" ADD CONSTRAINT "quality_certificates_inspection_lot_id_fkey" FOREIGN KEY ("inspection_lot_id") REFERENCES "inspection_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_certificates" ADD CONSTRAINT "quality_certificates_certified_by_fkey" FOREIGN KEY ("certified_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
