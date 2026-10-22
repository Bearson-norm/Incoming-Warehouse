/**
 * Replace cloud PostgreSQL RmCode catalog from RM CODE + SKU CSV (soft-delete + upsert).
 *
 * Usage (from Dashboard/api, DATABASE_URL = cloud Postgres):
 *   npx ts-node scripts/replace-rm-codes-csv.ts
 *   RM_SKU_CSV="C:\\path\\file.csv" npx ts-node scripts/replace-rm-codes-csv.ts
 *   DRY_RUN=1 npx ts-node scripts/replace-rm-codes-csv.ts
 *
 * npm run seed:rm-sku:dev / seed:rm-sku (after build:scripts)
 */
import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';
import {
  defaultRmSkuCsvPath,
  parseRmSkuCsv,
} from './lib/parse-rm-sku-csv';
import {
  ensureSeedMetaTable,
  getStoredRmSkuHash,
  setStoredRmSkuHash,
  sha256File,
} from './lib/rm-sku-seed-meta';

const REASON =
  process.env.RM_REPLACE_REASON?.trim() ||
  'Penggantian master RM dari Macro Inbound RMPM Batch V.5';
const ACTOR_USERNAME = process.env.RM_REPLACE_ACTOR?.trim() || 'import-script';

function forceReplace(): boolean {
  const v = process.env.RM_SKU_FORCE?.trim();
  return v === '1' || v === 'true';
}

async function main() {
  const csvPath = process.env.RM_SKU_CSV?.trim() || defaultRmSkuCsvPath();
  const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV not found: ${csvPath}`);
  }

  const fileHash = sha256File(csvPath);

  const { rows, warnings, skippedBlank } = parseRmSkuCsv(csvPath);
  for (const w of warnings) {
    console.warn(`[replace-rm] ${w}`);
  }
  if (rows.length === 0) {
    throw new Error('No RM rows parsed from CSV');
  }

  console.log(
    `[replace-rm] ${rows.length} unique codes from ${csvPath} (${warnings.length} warnings, ${skippedBlank} blank lines skipped)`,
  );

  if (dryRun) {
    console.log('[replace-rm] DRY_RUN — no database changes');
    return;
  }

  const prisma = new PrismaClient();
  const now = new Date();

  try {
    await ensureSeedMetaTable(prisma);
    const storedHash = await getStoredRmSkuHash(prisma);
    if (!dryRun && !forceReplace() && storedHash === fileHash) {
      console.log(
        `[replace-rm] CSV unchanged (sha256 ${fileHash.slice(0, 12)}…); skip replace`,
      );
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const active = await tx.rmCode.findMany({
        where: { deletedAt: null },
      });

      let deactivated = 0;
      for (const before of active) {
        const after = await tx.rmCode.update({
          where: { id: before.id },
          data: {
            deletedAt: now,
            revision: { increment: 1 },
          },
        });
        await tx.masterDataAuditEvent.create({
          data: {
            entityType: 'rmCode',
            entityCloudId: after.cloudId,
            action: 'delete',
            revision: after.revision,
            beforeJson: before as object,
            afterJson: after as object,
            reason: REASON,
            actorUsername: ACTOR_USERNAME,
          },
        });
        deactivated++;
      }

      let created = 0;
      let updated = 0;

      for (const row of rows) {
        const existing = await tx.rmCode.findUnique({
          where: { code: row.code },
        });

        if (existing) {
          const before = { ...existing };
          const after = await tx.rmCode.update({
            where: { id: existing.id },
            data: {
              name: row.name,
              vendorId: null,
              prodArea: null,
              deletedAt: null,
              revision: { increment: 1 },
            },
          });
          await tx.masterDataAuditEvent.create({
            data: {
              entityType: 'rmCode',
              entityCloudId: after.cloudId,
              action: 'update',
              revision: after.revision,
              beforeJson: before as object,
              afterJson: after as object,
              reason: REASON,
              actorUsername: ACTOR_USERNAME,
            },
          });
          updated++;
        } else {
          const after = await tx.rmCode.create({
            data: {
              code: row.code,
              name: row.name,
              vendorId: null,
              prodArea: null,
            },
          });
          await tx.masterDataAuditEvent.create({
            data: {
              entityType: 'rmCode',
              entityCloudId: after.cloudId,
              action: 'create',
              revision: after.revision,
              beforeJson: null,
              afterJson: after as object,
              reason: REASON,
              actorUsername: ACTOR_USERNAME,
            },
          });
          created++;
        }
      }

      const activeAfter = await tx.rmCode.count({ where: { deletedAt: null } });
      return {
        deactivated,
        created,
        updated,
        activeAfter,
      };
    });

    await setStoredRmSkuHash(prisma, fileHash);

    console.log(
      `[replace-rm] done: ${result.deactivated} deactivated, ${result.created} created, ${result.updated} updated; ${result.activeAfter} active RM codes`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
