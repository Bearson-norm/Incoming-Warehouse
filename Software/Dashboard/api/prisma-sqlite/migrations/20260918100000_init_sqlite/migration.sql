-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Packaging" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vendorId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "tareWeight" REAL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Packaging_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RmCode" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WeighSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "vendorId" INTEGER,
    "packagingId" INTEGER,
    "rmCodeId" INTEGER,
    "packageUid" TEXT,
    "gatewayId" TEXT,
    "weighingMethod" TEXT NOT NULL DEFAULT 'odoo',
    "flowType" TEXT NOT NULL DEFAULT 'incoming',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "autosaveEnabled" BOOLEAN NOT NULL DEFAULT true,
    "weighingStarted" BOOLEAN NOT NULL DEFAULT false,
    "labelMetadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WeighSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WeighSession_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WeighSession_packagingId_fkey" FOREIGN KEY ("packagingId") REFERENCES "Packaging" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WeighSession_rmCodeId_fkey" FOREIGN KEY ("rmCodeId") REFERENCES "RmCode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WeighReading" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sessionId" INTEGER NOT NULL,
    "weight" REAL NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "stable" BOOLEAN NOT NULL,
    "rawLine" TEXT,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "savedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "packageUid" TEXT,
    "odooLogId" INTEGER,
    "odooPackageId" INTEGER,
    "grossWeight" REAL,
    "tareWeight" REAL,
    "netWeight" REAL,
    "weightStatus" TEXT,
    "odooMessage" TEXT,
    "odooError" TEXT,
    CONSTRAINT "WeighReading_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WeighSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Gateway" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "gatewayId" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "lastSeenAt" DATETIME,
    "os" TEXT,
    "version" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "RmCode_code_key" ON "RmCode"("code");

-- CreateIndex
CREATE INDEX "WeighSession_packageUid_idx" ON "WeighSession"("packageUid");

-- CreateIndex
CREATE INDEX "WeighSession_gatewayId_idx" ON "WeighSession"("gatewayId");

-- CreateIndex
CREATE INDEX "WeighSession_userId_endedAt_idx" ON "WeighSession"("userId", "endedAt");

-- CreateIndex
CREATE INDEX "WeighSession_weighingMethod_idx" ON "WeighSession"("weighingMethod");

-- CreateIndex
CREATE INDEX "WeighSession_flowType_idx" ON "WeighSession"("flowType");

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
