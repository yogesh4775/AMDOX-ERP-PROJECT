-- AlterTable
ALTER TABLE "permissions" ADD COLUMN     "description" TEXT,
ADD COLUMN     "is_system" BOOLEAN NOT NULL DEFAULT false;
