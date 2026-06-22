-- AlterTable
ALTER TABLE "Feed" ADD COLUMN "scheduledAt" DATETIME;

-- CreateIndex
CREATE INDEX "Feed_status_scheduledAt_idx" ON "Feed"("status", "scheduledAt");
