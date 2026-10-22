import * as crypto from 'crypto';
import * as fs from 'fs';
import type { PrismaClient } from '@prisma/client';

export const RM_SKU_SEED_META_KEY = 'rm_sku_inbound_sha256';

export function sha256File(filePath: string): string {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

export async function ensureSeedMetaTable(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_SeedMeta" (
      "key" TEXT NOT NULL PRIMARY KEY,
      "value" TEXT NOT NULL,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export async function getStoredRmSkuHash(
  prisma: PrismaClient,
): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ value: string }[]>`
    SELECT "value" FROM "_SeedMeta" WHERE "key" = ${RM_SKU_SEED_META_KEY} LIMIT 1
  `;
  return rows[0]?.value ?? null;
}

export async function setStoredRmSkuHash(
  prisma: PrismaClient,
  hash: string,
): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO "_SeedMeta" ("key", "value", "updatedAt")
    VALUES (${RM_SKU_SEED_META_KEY}, ${hash}, CURRENT_TIMESTAMP)
    ON CONFLICT ("key") DO UPDATE SET
      "value" = EXCLUDED."value",
      "updatedAt" = CURRENT_TIMESTAMP
  `;
}
