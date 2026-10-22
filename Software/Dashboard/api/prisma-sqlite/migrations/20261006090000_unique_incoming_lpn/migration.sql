CREATE UNIQUE INDEX "WeighSession_incoming_packageUid_unique"
ON "WeighSession" (UPPER(TRIM("packageUid")))
WHERE "flowType" = 'incoming' AND "packageUid" IS NOT NULL AND TRIM("packageUid") <> '';
