-- Rebuild WeighReading so the column default is grams, and convert kg rows once.
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_WeighReading" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sessionId" INTEGER NOT NULL,
    "weight" REAL NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'g',
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
    "cloudSyncedAt" DATETIME,
    "cloudSyncError" TEXT,
    CONSTRAINT "WeighReading_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WeighSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_WeighReading" (
    "id",
    "sessionId",
    "weight",
    "unit",
    "stable",
    "rawLine",
    "capturedAt",
    "savedAt",
    "createdAt",
    "packageUid",
    "odooLogId",
    "odooPackageId",
    "grossWeight",
    "tareWeight",
    "netWeight",
    "weightStatus",
    "odooMessage",
    "odooError",
    "cloudSyncedAt",
    "cloudSyncError"
)
SELECT
    "id",
    "sessionId",
    CASE
        WHEN lower(trim(coalesce("unit", ''))) IN ('', 'kg') THEN "weight" * 1000
        ELSE "weight"
    END,
    CASE
        WHEN lower(trim(coalesce("unit", ''))) IN ('', 'kg') THEN 'g'
        ELSE "unit"
    END,
    "stable",
    "rawLine",
    "capturedAt",
    "savedAt",
    "createdAt",
    "packageUid",
    "odooLogId",
    "odooPackageId",
    CASE
        WHEN "grossWeight" IS NULL THEN NULL
        WHEN lower(trim(coalesce("unit", ''))) IN ('', 'kg') THEN "grossWeight" * 1000
        ELSE "grossWeight"
    END,
    CASE
        WHEN "tareWeight" IS NULL THEN NULL
        WHEN lower(trim(coalesce("unit", ''))) IN ('', 'kg') THEN "tareWeight" * 1000
        ELSE "tareWeight"
    END,
    CASE
        WHEN "netWeight" IS NULL THEN NULL
        WHEN lower(trim(coalesce("unit", ''))) IN ('', 'kg') THEN "netWeight" * 1000
        ELSE "netWeight"
    END,
    "weightStatus",
    "odooMessage",
    "odooError",
    "cloudSyncedAt",
    "cloudSyncError"
FROM "WeighReading";

DROP TABLE "WeighReading";
ALTER TABLE "new_WeighReading" RENAME TO "WeighReading";

CREATE INDEX "WeighReading_sessionId_idx" ON "WeighReading"("sessionId");
CREATE INDEX "WeighReading_capturedAt_idx" ON "WeighReading"("capturedAt");
CREATE INDEX "WeighReading_packageUid_idx" ON "WeighReading"("packageUid");
CREATE INDEX "WeighReading_cloudSyncedAt_idx" ON "WeighReading"("cloudSyncedAt");

-- Packaging has no unit column; every existing tare is kilograms.
UPDATE "Packaging"
SET "tareWeight" = "tareWeight" * 1000
WHERE "tareWeight" IS NOT NULL;

UPDATE "WeighSession"
SET "labelMetadata" = json_set(
    json_remove("labelMetadata", '$.sampleTareKg'),
    '$.sampleTareG',
    CAST(json_extract("labelMetadata", '$.sampleTareKg') AS REAL) * 1000
)
WHERE json_valid("labelMetadata")
  AND json_type("labelMetadata", '$.sampleTareKg') IN ('integer', 'real')
  AND json_extract("labelMetadata", '$.sampleTareG') IS NULL;

PRAGMA foreign_keys=ON;
