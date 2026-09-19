-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Packaging" (
    "id" SERIAL NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "tareWeight" DOUBLE PRECISION,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Packaging_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeighSession" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "vendorId" INTEGER,
    "packagingId" INTEGER,
    "packageUid" TEXT,
    "gatewayId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "autosaveEnabled" BOOLEAN NOT NULL DEFAULT true,
    "weighingStarted" BOOLEAN NOT NULL DEFAULT false,
    "labelMetadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeighSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeighReading" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "stable" BOOLEAN NOT NULL,
    "rawLine" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "savedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "packageUid" TEXT,
    "odooLogId" INTEGER,
    "odooPackageId" INTEGER,
    "grossWeight" DOUBLE PRECISION,
    "tareWeight" DOUBLE PRECISION,
    "netWeight" DOUBLE PRECISION,
    "weightStatus" TEXT,
    "odooMessage" TEXT,
    "odooError" TEXT,

    CONSTRAINT "WeighReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gateway" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "gatewayId" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "os" TEXT,
    "version" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gateway_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "WeighSession_packageUid_idx" ON "WeighSession"("packageUid");

-- CreateIndex
CREATE INDEX "WeighSession_gatewayId_idx" ON "WeighSession"("gatewayId");

-- CreateIndex
CREATE INDEX "WeighSession_userId_endedAt_idx" ON "WeighSession"("userId", "endedAt");

-- CreateIndex
CREATE INDEX "WeighReading_sessionId_idx" ON "WeighReading"("sessionId");

-- CreateIndex
CREATE INDEX "WeighReading_capturedAt_idx" ON "WeighReading"("capturedAt");

-- CreateIndex
CREATE INDEX "WeighReading_packageUid_idx" ON "WeighReading"("packageUid");

-- CreateIndex
CREATE UNIQUE INDEX "Gateway_gatewayId_key" ON "Gateway"("gatewayId");

-- CreateIndex
CREATE UNIQUE INDEX "Gateway_apiKey_key" ON "Gateway"("apiKey");

-- CreateIndex
CREATE INDEX "Gateway_gatewayId_idx" ON "Gateway"("gatewayId");

-- AddForeignKey
ALTER TABLE "Packaging" ADD CONSTRAINT "Packaging_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeighSession" ADD CONSTRAINT "WeighSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeighSession" ADD CONSTRAINT "WeighSession_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeighSession" ADD CONSTRAINT "WeighSession_packagingId_fkey" FOREIGN KEY ("packagingId") REFERENCES "Packaging"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeighReading" ADD CONSTRAINT "WeighReading_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WeighSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
