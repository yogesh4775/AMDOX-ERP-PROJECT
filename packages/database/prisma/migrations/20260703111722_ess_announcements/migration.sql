-- CreateTable
CREATE TABLE "company_announcements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "publish_date" TIMESTAMPTZ NOT NULL,
    "expiry_date" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "company_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "company_announcements_tenant_id_idx" ON "company_announcements"("tenant_id");

-- AddForeignKey
ALTER TABLE "company_announcements" ADD CONSTRAINT "company_announcements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
