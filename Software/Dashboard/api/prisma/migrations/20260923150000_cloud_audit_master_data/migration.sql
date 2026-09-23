ALTER TABLE "Vendor"
  ADD COLUMN "cloudId" TEXT,
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "Packaging"
  ADD COLUMN "cloudId" TEXT,
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "RmCode"
  ADD COLUMN "cloudId" TEXT,
  ADD COLUMN "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "deletedAt" TIMESTAMP(3);

UPDATE "Vendor" SET "cloudId" = CONCAT('legacy-vendor-', "id") WHERE "cloudId" IS NULL;
UPDATE "Packaging" SET "cloudId" = CONCAT('legacy-packaging-', "id") WHERE "cloudId" IS NULL;
UPDATE "RmCode" SET "cloudId" = CONCAT('legacy-rm-', "id") WHERE "cloudId" IS NULL;

ALTER TABLE "Vendor" ALTER COLUMN "cloudId" SET NOT NULL;
ALTER TABLE "Packaging" ALTER COLUMN "cloudId" SET NOT NULL;
ALTER TABLE "RmCode" ALTER COLUMN "cloudId" SET NOT NULL;

CREATE UNIQUE INDEX "Vendor_cloudId_key" ON "Vendor"("cloudId");
CREATE INDEX "Vendor_updatedAt_idx" ON "Vendor"("updatedAt");
CREATE INDEX "Vendor_deletedAt_idx" ON "Vendor"("deletedAt");
CREATE UNIQUE INDEX "Packaging_cloudId_key" ON "Packaging"("cloudId");
CREATE INDEX "Packaging_vendorId_deletedAt_idx" ON "Packaging"("vendorId", "deletedAt");
CREATE INDEX "Packaging_updatedAt_idx" ON "Packaging"("updatedAt");
CREATE UNIQUE INDEX "RmCode_cloudId_key" ON "RmCode"("cloudId");
CREATE INDEX "RmCode_updatedAt_idx" ON "RmCode"("updatedAt");
CREATE INDEX "RmCode_deletedAt_idx" ON "RmCode"("deletedAt");

ALTER TABLE "CloudWeighReading"
  ADD COLUMN "eventId" TEXT,
  ADD COLUMN "deviceId" TEXT,
  ADD COLUMN "gatewayId" TEXT,
  ADD COLUMN "localSessionId" INTEGER,
  ADD COLUMN "vendorCloudId" TEXT,
  ADD COLUMN "vendorSnapshot" TEXT,
  ADD COLUMN "packagingCloudId" TEXT,
  ADD COLUMN "packagingSnapshot" TEXT,
  ADD COLUMN "rmCodeCloudId" TEXT,
  ADD COLUMN "rmCodeSnapshot" TEXT,
  ADD COLUMN "labelMetadata" TEXT,
  ADD COLUMN "odooLogId" INTEGER,
  ADD COLUMN "odooPackageId" INTEGER;

CREATE UNIQUE INDEX "CloudWeighReading_eventId_key" ON "CloudWeighReading"("eventId");
CREATE INDEX "CloudWeighReading_packageUid_capturedAt_idx" ON "CloudWeighReading"("packageUid", "capturedAt");
CREATE INDEX "CloudWeighReading_vendorCloudId_idx" ON "CloudWeighReading"("vendorCloudId");
CREATE INDEX "CloudWeighReading_rmCodeCloudId_idx" ON "CloudWeighReading"("rmCodeCloudId");

CREATE TABLE "MasterDataAuditEvent" (
  "id" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityCloudId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "beforeJson" JSONB,
  "afterJson" JSONB,
  "reason" TEXT NOT NULL,
  "actorUserId" INTEGER,
  "actorUsername" TEXT NOT NULL,
  "stationId" TEXT,
  "deviceId" TEXT,
  "requestId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MasterDataAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MasterDataAuditEvent_entityType_entityCloudId_revision_idx"
  ON "MasterDataAuditEvent"("entityType", "entityCloudId", "revision");
CREATE INDEX "MasterDataAuditEvent_createdAt_idx" ON "MasterDataAuditEvent"("createdAt");
CREATE INDEX "MasterDataAuditEvent_actorUsername_idx" ON "MasterDataAuditEvent"("actorUsername");

CREATE TABLE "LpnTraceEvent" (
  "id" TEXT NOT NULL,
  "stationId" TEXT NOT NULL,
  "localEventId" TEXT NOT NULL,
  "packageUid" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "deviceId" TEXT,
  "gatewayId" TEXT,
  "scaleId" INTEGER,
  "scaleName" TEXT,
  "sourceAt" TIMESTAMP(3) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LpnTraceEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LpnTraceEvent_stationId_localEventId_key"
  ON "LpnTraceEvent"("stationId", "localEventId");
CREATE INDEX "LpnTraceEvent_packageUid_sourceAt_idx" ON "LpnTraceEvent"("packageUid", "sourceAt");
CREATE INDEX "LpnTraceEvent_stationId_sourceAt_idx" ON "LpnTraceEvent"("stationId", "sourceAt");
CREATE INDEX "LpnTraceEvent_eventType_idx" ON "LpnTraceEvent"("eventType");
