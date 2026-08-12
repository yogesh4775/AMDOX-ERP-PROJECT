-- CreateEnum
CREATE TYPE "BankAccountCategory" AS ENUM ('SAVINGS', 'CURRENT', 'CREDIT_CARD', 'TREASURY');

-- CreateEnum
CREATE TYPE "BankAccountStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "BankTransactionType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'ADJUSTMENT', 'BANK_CHARGES', 'INTEREST_INCOME', 'INTEREST_EXPENSE');

-- CreateEnum
CREATE TYPE "BankTransactionStatus" AS ENUM ('PENDING', 'POSTED', 'CLEARED', 'VOIDED');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('DRAFT', 'COMPLETED');

-- CreateEnum
CREATE TYPE "MatchingStatus" AS ENUM ('AUTO_MATCHED', 'MANUALLY_MATCHED', 'PARTIALLY_MATCHED', 'UNMATCHED');

-- AlterEnum
ALTER TYPE "JournalSourceType" ADD VALUE 'BANK';

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "account_number" VARCHAR(50) NOT NULL,
    "iban" VARCHAR(50),
    "swift_code" VARCHAR(50),
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "category" "BankAccountCategory" NOT NULL DEFAULT 'CURRENT',
    "opening_balance" DECIMAL(12,4) NOT NULL,
    "current_balance" DECIMAL(12,4) NOT NULL,
    "gl_account_id" UUID NOT NULL,
    "status" "BankAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transactions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "bank_account_id" UUID NOT NULL,
    "type" "BankTransactionType" NOT NULL,
    "amount" DECIMAL(12,4) NOT NULL,
    "transaction_date" TIMESTAMPTZ NOT NULL,
    "reference" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "status" "BankTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "cleared_at" TIMESTAMPTZ,
    "journal_entry_id" UUID,
    "transfer_to_bank_account_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_reconciliations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "bank_account_id" UUID NOT NULL,
    "statement_number" VARCHAR(50) NOT NULL,
    "statement_date" TIMESTAMPTZ NOT NULL,
    "start_date" TIMESTAMPTZ NOT NULL,
    "end_date" TIMESTAMPTZ NOT NULL,
    "opening_balance" DECIMAL(12,4) NOT NULL,
    "closing_balance" DECIMAL(12,4) NOT NULL,
    "reconciled_balance" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "bank_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_reconciliation_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "reconciliation_id" UUID NOT NULL,
    "bank_transaction_id" UUID,
    "statement_line_date" TIMESTAMPTZ NOT NULL,
    "statement_line_ref" VARCHAR(100) NOT NULL,
    "statement_line_amount" DECIMAL(12,4) NOT NULL,
    "matching_status" "MatchingStatus" NOT NULL DEFAULT 'UNMATCHED',
    "matched_amount" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "reconciled_journal_line_id" UUID,

    CONSTRAINT "bank_reconciliation_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bank_accounts_tenant_id_idx" ON "bank_accounts"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_tenant_id_account_number_key" ON "bank_accounts"("tenant_id", "account_number");

-- CreateIndex
CREATE INDEX "bank_transactions_tenant_id_idx" ON "bank_transactions"("tenant_id");

-- CreateIndex
CREATE INDEX "bank_reconciliations_tenant_id_idx" ON "bank_reconciliations"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_reconciliations_tenant_id_bank_account_id_statement_nu_key" ON "bank_reconciliations"("tenant_id", "bank_account_id", "statement_number");

-- CreateIndex
CREATE INDEX "bank_reconciliation_lines_tenant_id_idx" ON "bank_reconciliation_lines"("tenant_id");

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_transfer_to_bank_account_id_fkey" FOREIGN KEY ("transfer_to_bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_reconciliation_lines" ADD CONSTRAINT "bank_reconciliation_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_reconciliation_lines" ADD CONSTRAINT "bank_reconciliation_lines_reconciliation_id_fkey" FOREIGN KEY ("reconciliation_id") REFERENCES "bank_reconciliations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_reconciliation_lines" ADD CONSTRAINT "bank_reconciliation_lines_bank_transaction_id_fkey" FOREIGN KEY ("bank_transaction_id") REFERENCES "bank_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_reconciliation_lines" ADD CONSTRAINT "bank_reconciliation_lines_reconciled_journal_line_id_fkey" FOREIGN KEY ("reconciled_journal_line_id") REFERENCES "journal_entry_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
