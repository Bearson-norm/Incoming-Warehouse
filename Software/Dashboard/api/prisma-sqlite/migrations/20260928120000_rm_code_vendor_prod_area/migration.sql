-- AlterTable
ALTER TABLE "RmCode" ADD COLUMN "vendorId" INTEGER;
ALTER TABLE "RmCode" ADD COLUMN "prodArea" TEXT;

-- CreateIndex
CREATE INDEX "RmCode_vendorId_deletedAt_idx" ON "RmCode"("vendorId", "deletedAt");
