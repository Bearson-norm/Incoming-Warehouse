-- AlterTable
ALTER TABLE "RmCode" ADD COLUMN "vendorId" INTEGER,
ADD COLUMN "prodArea" TEXT;

-- CreateIndex
CREATE INDEX "RmCode_vendorId_deletedAt_idx" ON "RmCode"("vendorId", "deletedAt");

-- AddForeignKey
ALTER TABLE "RmCode" ADD CONSTRAINT "RmCode_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
