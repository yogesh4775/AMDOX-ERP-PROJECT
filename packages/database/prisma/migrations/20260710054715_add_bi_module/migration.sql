-- CreateTable
CREATE TABLE "bi_dimension_products" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "sku" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "category_name" VARCHAR(100),
    "cost_price" DOUBLE PRECISION NOT NULL,
    "sale_price" DOUBLE PRECISION NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "bi_dimension_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bi_dimension_customers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "region" VARCHAR(100),
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "bi_dimension_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bi_dimension_employees" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "department_name" VARCHAR(100),
    "designation_name" VARCHAR(100),
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "bi_dimension_employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bi_dimension_accounts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "bi_dimension_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bi_dimension_warehouses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "bi_dimension_warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bi_facts_finance" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "financial_period_id" UUID,
    "account_id" UUID,
    "debit" DOUBLE PRECISION NOT NULL,
    "credit" DOUBLE PRECISION NOT NULL,
    "net_amount" DOUBLE PRECISION NOT NULL,
    "posting_date" TIMESTAMPTZ NOT NULL,
    "budget_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "variance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bi_facts_finance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bi_facts_sales" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID,
    "product_id" UUID,
    "quantity" DOUBLE PRECISION NOT NULL,
    "order_value" DOUBLE PRECISION NOT NULL,
    "cost_value" DOUBLE PRECISION NOT NULL,
    "gross_margin" DOUBLE PRECISION NOT NULL,
    "order_date" TIMESTAMPTZ NOT NULL,
    "delivery_time_hours" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bi_facts_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bi_facts_procurement" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID,
    "quantity" DOUBLE PRECISION NOT NULL,
    "purchase_value" DOUBLE PRECISION NOT NULL,
    "lead_time_hours" DOUBLE PRECISION,
    "received_quantity" DOUBLE PRECISION,
    "variance_percentage" DOUBLE PRECISION,
    "order_date" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bi_facts_procurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bi_facts_inventory" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID,
    "warehouse_id" UUID,
    "stock_on_hand" DOUBLE PRECISION NOT NULL,
    "stock_value" DOUBLE PRECISION NOT NULL,
    "turnover_rate" DOUBLE PRECISION,
    "movement_quantity_in" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "movement_quantity_out" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "adjustment_quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "snapshot_date" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bi_facts_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bi_facts_manufacturing" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID,
    "work_center_id" UUID,
    "cycle_time_minutes" DOUBLE PRECISION,
    "planned_quantity" DOUBLE PRECISION NOT NULL,
    "actual_quantity" DOUBLE PRECISION NOT NULL,
    "scrap_quantity" DOUBLE PRECISION NOT NULL,
    "rework_quantity" DOUBLE PRECISION NOT NULL,
    "efficiency_percentage" DOUBLE PRECISION,
    "completion_date" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bi_facts_manufacturing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bi_facts_quality" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID,
    "lot_quantity" DOUBLE PRECISION NOT NULL,
    "sample_size" DOUBLE PRECISION NOT NULL,
    "accepted_quantity" DOUBLE PRECISION NOT NULL,
    "rejected_quantity" DOUBLE PRECISION NOT NULL,
    "defect_count" INTEGER NOT NULL,
    "nc_count" INTEGER NOT NULL,
    "pass_rate" DOUBLE PRECISION NOT NULL,
    "inspection_date" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bi_facts_quality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bi_facts_customer_service" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID,
    "product_id" UUID,
    "ticket_count" INTEGER NOT NULL DEFAULT 0,
    "resolved_count" INTEGER NOT NULL DEFAULT 0,
    "sla_breached_count" INTEGER NOT NULL DEFAULT 0,
    "resolution_time_hours" DOUBLE PRECISION,
    "csat_rating" DOUBLE PRECISION,
    "log_date" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bi_facts_customer_service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bi_facts_transportation" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "carrier_id" UUID,
    "shipment_count" INTEGER NOT NULL DEFAULT 0,
    "delayed_count" INTEGER NOT NULL DEFAULT 0,
    "exception_count" INTEGER NOT NULL DEFAULT 0,
    "trip_count" INTEGER NOT NULL DEFAULT 0,
    "fuel_odometer_miles" DOUBLE PRECISION,
    "fuel_gallons" DOUBLE PRECISION,
    "fuel_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mpg" DOUBLE PRECISION,
    "freight_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "log_date" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bi_facts_transportation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bi_facts_hr" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID,
    "employee_count" INTEGER NOT NULL DEFAULT 0,
    "salary_spend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "attendance_rate" DOUBLE PRECISION,
    "leave_hours_requested" DOUBLE PRECISION,
    "appraisal_count" INTEGER NOT NULL DEFAULT 0,
    "log_date" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bi_facts_hr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bi_facts_workflow" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "instance_count" INTEGER NOT NULL DEFAULT 0,
    "completed_count" INTEGER NOT NULL DEFAULT 0,
    "rejected_count" INTEGER NOT NULL DEFAULT 0,
    "average_lead_time_hours" DOUBLE PRECISION,
    "step_count" INTEGER NOT NULL DEFAULT 0,
    "step_duration_hours" DOUBLE PRECISION,
    "log_date" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bi_facts_workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bi_facts_security" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "login_attempts" INTEGER NOT NULL DEFAULT 0,
    "failed_logins" INTEGER NOT NULL DEFAULT 0,
    "security_event_count" INTEGER NOT NULL DEFAULT 0,
    "audit_log_count" INTEGER NOT NULL DEFAULT 0,
    "log_date" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bi_facts_security_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bi_kpi_definitions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "target" DOUBLE PRECISION NOT NULL,
    "threshold_alert" DOUBLE PRECISION NOT NULL,
    "module" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "bi_kpi_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bi_kpi_values" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "kpi_definition_id" UUID NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "computed_date" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bi_kpi_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bi_historical_snapshots" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "snapshot_type" VARCHAR(100) NOT NULL,
    "snapshot_date" TIMESTAMPTZ NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bi_historical_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bi_report_definitions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "module" VARCHAR(100) NOT NULL,
    "config" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "bi_report_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bi_report_schedules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "report_definition_id" UUID NOT NULL,
    "recipient_email" VARCHAR(255) NOT NULL,
    "cron_expression" VARCHAR(100) NOT NULL,
    "format" VARCHAR(50) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "bi_report_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bi_etl_watermarks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "pipeline_name" VARCHAR(100) NOT NULL,
    "last_sync_time" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "bi_etl_watermarks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bi_dimension_products_tenant_id_id_key" ON "bi_dimension_products"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "bi_dimension_customers_tenant_id_id_key" ON "bi_dimension_customers"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "bi_dimension_employees_tenant_id_id_key" ON "bi_dimension_employees"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "bi_dimension_accounts_tenant_id_id_key" ON "bi_dimension_accounts"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "bi_dimension_warehouses_tenant_id_id_key" ON "bi_dimension_warehouses"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "bi_facts_finance_tenant_id_posting_date_idx" ON "bi_facts_finance"("tenant_id", "posting_date");

-- CreateIndex
CREATE INDEX "bi_facts_sales_tenant_id_order_date_idx" ON "bi_facts_sales"("tenant_id", "order_date");

-- CreateIndex
CREATE INDEX "bi_facts_procurement_tenant_id_order_date_idx" ON "bi_facts_procurement"("tenant_id", "order_date");

-- CreateIndex
CREATE INDEX "bi_facts_inventory_tenant_id_snapshot_date_idx" ON "bi_facts_inventory"("tenant_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "bi_facts_manufacturing_tenant_id_completion_date_idx" ON "bi_facts_manufacturing"("tenant_id", "completion_date");

-- CreateIndex
CREATE INDEX "bi_facts_quality_tenant_id_inspection_date_idx" ON "bi_facts_quality"("tenant_id", "inspection_date");

-- CreateIndex
CREATE INDEX "bi_facts_customer_service_tenant_id_log_date_idx" ON "bi_facts_customer_service"("tenant_id", "log_date");

-- CreateIndex
CREATE INDEX "bi_facts_transportation_tenant_id_log_date_idx" ON "bi_facts_transportation"("tenant_id", "log_date");

-- CreateIndex
CREATE INDEX "bi_facts_hr_tenant_id_log_date_idx" ON "bi_facts_hr"("tenant_id", "log_date");

-- CreateIndex
CREATE INDEX "bi_facts_workflow_tenant_id_log_date_idx" ON "bi_facts_workflow"("tenant_id", "log_date");

-- CreateIndex
CREATE INDEX "bi_facts_security_tenant_id_log_date_idx" ON "bi_facts_security"("tenant_id", "log_date");

-- CreateIndex
CREATE UNIQUE INDEX "bi_kpi_definitions_tenant_id_code_key" ON "bi_kpi_definitions"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "bi_kpi_values_tenant_id_computed_date_idx" ON "bi_kpi_values"("tenant_id", "computed_date");

-- CreateIndex
CREATE INDEX "bi_historical_snapshots_tenant_id_snapshot_date_idx" ON "bi_historical_snapshots"("tenant_id", "snapshot_date");

-- CreateIndex
CREATE UNIQUE INDEX "bi_etl_watermarks_tenant_id_pipeline_name_key" ON "bi_etl_watermarks"("tenant_id", "pipeline_name");

-- AddForeignKey
ALTER TABLE "bi_facts_finance" ADD CONSTRAINT "bi_facts_finance_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "bi_dimension_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bi_facts_sales" ADD CONSTRAINT "bi_facts_sales_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "bi_dimension_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bi_facts_sales" ADD CONSTRAINT "bi_facts_sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "bi_dimension_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bi_facts_procurement" ADD CONSTRAINT "bi_facts_procurement_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "bi_dimension_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bi_facts_inventory" ADD CONSTRAINT "bi_facts_inventory_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "bi_dimension_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bi_facts_inventory" ADD CONSTRAINT "bi_facts_inventory_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "bi_dimension_warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bi_facts_manufacturing" ADD CONSTRAINT "bi_facts_manufacturing_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "bi_dimension_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bi_facts_quality" ADD CONSTRAINT "bi_facts_quality_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "bi_dimension_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bi_facts_customer_service" ADD CONSTRAINT "bi_facts_customer_service_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "bi_dimension_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bi_facts_customer_service" ADD CONSTRAINT "bi_facts_customer_service_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "bi_dimension_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bi_facts_hr" ADD CONSTRAINT "bi_facts_hr_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "bi_dimension_employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bi_kpi_values" ADD CONSTRAINT "bi_kpi_values_kpi_definition_id_fkey" FOREIGN KEY ("kpi_definition_id") REFERENCES "bi_kpi_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bi_report_schedules" ADD CONSTRAINT "bi_report_schedules_report_definition_id_fkey" FOREIGN KEY ("report_definition_id") REFERENCES "bi_report_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
