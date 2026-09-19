-- AlterTable
ALTER TABLE "WeighSession" ADD COLUMN "scaleId" INTEGER,
ADD COLUMN "scaleName" TEXT;

-- AlterTable
ALTER TABLE "WeighReading" ADD COLUMN "cloudSyncedAt" TIMESTAMP(3),
ADD COLUMN "cloudSyncError" TEXT;

-- CreateTable
CREATE TABLE "CloudScale" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CloudScale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloudWeighReading" (
    "id" SERIAL NOT NULL,
    "scaleId" INTEGER NOT NULL,
    "scaleName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "stationId" TEXT,
    "localReadingId" INTEGER,
    "packageUid" TEXT,
    "flowType" TEXT NOT NULL,
    "weighingMethod" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "grossWeight" DOUBLE PRECISION,
    "tareWeight" DOUBLE PRECISION,
    "netWeight" DOUBLE PRECISION,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "weightStatus" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CloudWeighReading_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CloudScale_name_key" ON "CloudScale"("name");

-- CreateIndex
CREATE INDEX "CloudScale_isActive_idx" ON "CloudScale"("isActive");

-- CreateIndex
CREATE INDEX "CloudWeighReading_username_idx" ON "CloudWeighReading"("username");

-- CreateIndex
CREATE INDEX "CloudWeighReading_scaleId_idx" ON "CloudWeighReading"("scaleId");

-- CreateIndex
CREATE INDEX "CloudWeighReading_capturedAt_idx" ON "CloudWeighReading"("capturedAt");

-- CreateIndex
CREATE INDEX "CloudWeighReading_stationId_idx" ON "CloudWeighReading"("stationId");

-- CreateIndex
CREATE UNIQUE INDEX "CloudWeighReading_stationId_localReadingId_key" ON "CloudWeighReading"("stationId", "localReadingId");

-- CreateIndex
CREATE INDEX "WeighSession_scaleId_idx" ON "WeighSession"("scaleId");

-- CreateIndex
CREATE INDEX "WeighReading_cloudSyncedAt_idx" ON "WeighReading"("cloudSyncedAt");

-- AddForeignKey
ALTER TABLE "CloudWeighReading" ADD CONSTRAINT "CloudWeighReading_scaleId_fkey" FOREIGN KEY ("scaleId") REFERENCES "CloudScale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
