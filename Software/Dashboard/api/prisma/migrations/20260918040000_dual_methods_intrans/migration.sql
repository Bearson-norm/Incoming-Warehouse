-- CreateTable
CREATE TABLE "RmCode" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RmCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RmCode_code_key" ON "RmCode"("code");

-- AlterTable
ALTER TABLE "WeighSession" ADD COLUMN "rmCodeId" INTEGER;
ALTER TABLE "WeighSession" ADD COLUMN "weighingMethod" TEXT NOT NULL DEFAULT 'odoo';
ALTER TABLE "WeighSession" ADD COLUMN "flowType" TEXT NOT NULL DEFAULT 'incoming';

-- CreateIndex
CREATE INDEX "WeighSession_weighingMethod_idx" ON "WeighSession"("weighingMethod");

-- CreateIndex
CREATE INDEX "WeighSession_flowType_idx" ON "WeighSession"("flowType");

-- AddForeignKey
ALTER TABLE "WeighSession" ADD CONSTRAINT "WeighSession_rmCodeId_fkey" FOREIGN KEY ("rmCodeId") REFERENCES "RmCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
