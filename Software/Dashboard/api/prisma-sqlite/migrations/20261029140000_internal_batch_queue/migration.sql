-- AlterTable
ALTER TABLE "WeighSession" ADD COLUMN "batchGroupId" TEXT;
ALTER TABLE "WeighSession" ADD COLUMN "batchSequence" INTEGER;
ALTER TABLE "WeighSession" ADD COLUMN "batchSize" INTEGER;
ALTER TABLE "WeighSession" ADD COLUMN "queueStatus" TEXT;

-- CreateIndex
CREATE INDEX "WeighSession_batchGroupId_idx" ON "WeighSession"("batchGroupId");
