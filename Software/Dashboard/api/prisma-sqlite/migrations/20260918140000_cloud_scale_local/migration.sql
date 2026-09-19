-- AlterTable
ALTER TABLE "WeighSession" ADD COLUMN "scaleId" INTEGER;
ALTER TABLE "WeighSession" ADD COLUMN "scaleName" TEXT;

-- AlterTable
ALTER TABLE "WeighReading" ADD COLUMN "cloudSyncedAt" DATETIME;
ALTER TABLE "WeighReading" ADD COLUMN "cloudSyncError" TEXT;

-- CreateIndex
CREATE INDEX "WeighSession_scaleId_idx" ON "WeighSession"("scaleId");

-- CreateIndex
CREATE INDEX "WeighReading_cloudSyncedAt_idx" ON "WeighReading"("cloudSyncedAt");
