-- Weights are stored and exchanged in grams.
ALTER TABLE "WeighReading" ALTER COLUMN "unit" SET DEFAULT 'g';
ALTER TABLE "CloudWeighReading" ALTER COLUMN "unit" SET DEFAULT 'g';

UPDATE "WeighReading"
SET
    "weight" = "weight" * 1000,
    "grossWeight" = CASE WHEN "grossWeight" IS NULL THEN NULL ELSE "grossWeight" * 1000 END,
    "tareWeight" = CASE WHEN "tareWeight" IS NULL THEN NULL ELSE "tareWeight" * 1000 END,
    "netWeight" = CASE WHEN "netWeight" IS NULL THEN NULL ELSE "netWeight" * 1000 END,
    "unit" = 'g'
WHERE lower(trim(coalesce("unit", ''))) IN ('', 'kg');

UPDATE "CloudWeighReading"
SET
    "weight" = "weight" * 1000,
    "grossWeight" = CASE WHEN "grossWeight" IS NULL THEN NULL ELSE "grossWeight" * 1000 END,
    "tareWeight" = CASE WHEN "tareWeight" IS NULL THEN NULL ELSE "tareWeight" * 1000 END,
    "netWeight" = CASE WHEN "netWeight" IS NULL THEN NULL ELSE "netWeight" * 1000 END,
    "unit" = 'g'
WHERE lower(trim(coalesce("unit", ''))) IN ('', 'kg');

-- Packaging has no unit column; every existing tare is kilograms.
UPDATE "Packaging"
SET "tareWeight" = "tareWeight" * 1000
WHERE "tareWeight" IS NOT NULL;

DO $$
DECLARE
  rec RECORD;
  parsed jsonb;
BEGIN
  FOR rec IN
    SELECT id, "labelMetadata" AS meta
    FROM "WeighSession"
    WHERE "labelMetadata" IS NOT NULL
  LOOP
    BEGIN
      parsed := rec.meta::jsonb;
    EXCEPTION WHEN others THEN
      CONTINUE;
    END;
    IF jsonb_typeof(parsed -> 'sampleTareKg') = 'number'
       AND (parsed -> 'sampleTareG') IS NULL THEN
      UPDATE "WeighSession"
      SET "labelMetadata" = (
        jsonb_set(
          parsed - 'sampleTareKg',
          '{sampleTareG}',
          to_jsonb((parsed ->> 'sampleTareKg')::double precision * 1000)
        )
      )::text
      WHERE id = rec.id;
    END IF;
  END LOOP;

  FOR rec IN
    SELECT id, "labelMetadata" AS meta
    FROM "CloudWeighReading"
    WHERE "labelMetadata" IS NOT NULL
  LOOP
    BEGIN
      parsed := rec.meta::jsonb;
    EXCEPTION WHEN others THEN
      CONTINUE;
    END;
    IF jsonb_typeof(parsed -> 'sampleTareKg') = 'number'
       AND (parsed -> 'sampleTareG') IS NULL THEN
      UPDATE "CloudWeighReading"
      SET "labelMetadata" = (
        jsonb_set(
          parsed - 'sampleTareKg',
          '{sampleTareG}',
          to_jsonb((parsed ->> 'sampleTareKg')::double precision * 1000)
        )
      )::text
      WHERE id = rec.id;
    END IF;
  END LOOP;
END $$;
