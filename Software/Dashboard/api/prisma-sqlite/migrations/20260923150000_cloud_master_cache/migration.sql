ALTER TABLE "Vendor" ADD COLUMN "cloudId" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Vendor" ADD COLUMN "deletedAt" DATETIME;
UPDATE "Vendor" SET "cloudId" = 'legacy-vendor-' || "id" WHERE "cloudId" IS NULL;

ALTER TABLE "Packaging" ADD COLUMN "cloudId" TEXT;
ALTER TABLE "Packaging" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Packaging" ADD COLUMN "deletedAt" DATETIME;
UPDATE "Packaging" SET "cloudId" = 'legacy-packaging-' || "id" WHERE "cloudId" IS NULL;

ALTER TABLE "RmCode" ADD COLUMN "cloudId" TEXT;
ALTER TABLE "RmCode" ADD COLUMN "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "RmCode" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "RmCode" ADD COLUMN "deletedAt" DATETIME;
UPDATE "RmCode" SET "cloudId" = 'legacy-rm-' || "id" WHERE "cloudId" IS NULL;

CREATE UNIQUE INDEX "Vendor_cloudId_key" ON "Vendor"("cloudId");
CREATE INDEX "Vendor_updatedAt_idx" ON "Vendor"("updatedAt");
CREATE INDEX "Vendor_deletedAt_idx" ON "Vendor"("deletedAt");
CREATE UNIQUE INDEX "Packaging_cloudId_key" ON "Packaging"("cloudId");
CREATE INDEX "Packaging_vendorId_deletedAt_idx" ON "Packaging"("vendorId", "deletedAt");
CREATE INDEX "Packaging_updatedAt_idx" ON "Packaging"("updatedAt");
CREATE UNIQUE INDEX "RmCode_cloudId_key" ON "RmCode"("cloudId");
CREATE INDEX "RmCode_updatedAt_idx" ON "RmCode"("updatedAt");
CREATE INDEX "RmCode_deletedAt_idx" ON "RmCode"("deletedAt");

CREATE TABLE "MasterDataSyncState" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
  "cursor" TEXT,
  "lastSyncedAt" DATETIME,
  "lastError" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "LpnTraceOutbox" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "localEventId" TEXT NOT NULL,
  "packageUid" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" TEXT,
  "sourceAt" DATETIME NOT NULL,
  "syncedAt" DATETIME,
  "syncError" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "LpnTraceOutbox_localEventId_key" ON "LpnTraceOutbox"("localEventId");
CREATE INDEX "LpnTraceOutbox_syncedAt_idx" ON "LpnTraceOutbox"("syncedAt");
CREATE INDEX "LpnTraceOutbox_packageUid_sourceAt_idx" ON "LpnTraceOutbox"("packageUid", "sourceAt");
