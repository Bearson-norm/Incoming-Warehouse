/**
 * Import packaging (jerigen) tare standards from CSV.
 *
 * Usage (from Dashboard/api):
 *   DATABASE_URL=... npm run seed:tare
 *   TARE_CSV=/path/to/file.csv npm run seed:tare
 */
import { PrismaClient } from '@prisma/client';
import {
  defaultTareCsvPath,
  parseTareJerrycanCsv,
} from './lib/parse-tare-jerrycan-csv';
import { resolveOrCreateTareVendor } from './lib/resolve-tare-vendor';

async function main() {
  const csvPath = process.env.TARE_CSV?.trim() || defaultTareCsvPath();
  const rows = parseTareJerrycanCsv(csvPath);

  const prisma = new PrismaClient();
  try {
    const vendorsCache = await prisma.vendor.findMany({
      where: { deletedAt: null },
    });

    let vendorsCreated = 0;
    let packagingCreated = 0;
    let packagingUpdated = 0;

    for (const row of rows) {
      const { vendor, created: vendorCreated } =
        await resolveOrCreateTareVendor(
          prisma,
          row.supplierName,
          vendorsCache,
        );
      if (vendorCreated) {
        vendorsCreated++;
        console.log(
          `[import-tare] Created vendor: ${vendor.name} (from CSV: ${row.supplierName})`,
        );
      }

      const tareKg = row.tareWeightGr / 1000;
      const metadata = JSON.stringify({
        grossWeightGr: row.grossWeightGr,
        tareWeightGr: row.tareWeightGr,
        source: 'standar-tare-jerrycan',
      });

      const existing = await prisma.packaging.findFirst({
        where: {
          vendorId: vendor.id,
          name: row.packagingName,
          deletedAt: null,
        },
      });

      if (existing) {
        await prisma.packaging.update({
          where: { id: existing.id },
          data: { tareWeight: tareKg, metadata },
        });
        packagingUpdated++;
      } else {
        await prisma.packaging.create({
          data: {
            vendorId: vendor.id,
            name: row.packagingName,
            tareWeight: tareKg,
            metadata,
          },
        });
        packagingCreated++;
      }
    }

    console.log(
      `[import-tare] ${rows.length} rows from ${csvPath} — vendors created: ${vendorsCreated}, packaging created: ${packagingCreated}, updated: ${packagingUpdated}`,
    );

    const seeded = await prisma.packaging.findMany({
      where: {
        deletedAt: null,
        metadata: { contains: 'standar-tare-jerrycan' },
      },
      include: { vendor: { select: { name: true } } },
      orderBy: [{ vendor: { name: 'asc' } }, { name: 'asc' }],
    });
    const byVendor = new Map<string, number>();
    for (const p of seeded) {
      const vendorName = p.vendor.name;
      byVendor.set(vendorName, (byVendor.get(vendorName) ?? 0) + 1);
    }
    console.log(
      `[import-tare] verify: ${seeded.length} packaging row(s) tagged standar-tare-jerrycan`,
    );
    for (const [vendorName, count] of [...byVendor.entries()].sort((a, b) =>
      a[0].localeCompare(b[0]),
    )) {
      console.log(`[import-tare]   ${vendorName}: ${count}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
