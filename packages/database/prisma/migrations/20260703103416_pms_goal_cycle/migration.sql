/*
  Warnings:

  - Added the required column `appraisal_cycle_id` to the `performance_goals` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "performance_goals" ADD COLUMN     "appraisal_cycle_id" UUID NOT NULL;

-- CreateIndex
CREATE INDEX "performance_goals_appraisal_cycle_id_idx" ON "performance_goals"("appraisal_cycle_id");

-- AddForeignKey
ALTER TABLE "performance_goals" ADD CONSTRAINT "performance_goals_appraisal_cycle_id_fkey" FOREIGN KEY ("appraisal_cycle_id") REFERENCES "appraisal_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
