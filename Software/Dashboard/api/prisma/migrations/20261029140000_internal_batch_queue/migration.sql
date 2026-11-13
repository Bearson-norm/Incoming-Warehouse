-- AlterTable
ALTER TABLE "WeighSession" ADD COLUMN "batchGroupId" TEXT,
ADD COLUMN "batchSequence" INTEGER,
ADD COLUMN "batchSize" INTEGER,
ADD COLUMN "queueStatus" TEXT;

-- CreateIndex
CREATE INDEX "WeighSession_batchGroupId_idx" ON "WeighSession"("batchGroupId");
