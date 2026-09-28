/**
 * Import RM master data from products CSV (vendors + RmCode rows).
 *
 * Usage (from Dashboard/api):
 *   DATABASE_URL=file:./dev.db npx ts-node scripts/import-products-csv.ts
 *   PRODUCTS_CSV=C:\path\to\products.csv npm run seed:products
 */
import { PrismaClient } from '@prisma/client';
import {
  defaultProductsCsvPath,
  parseProductsCsv,
} from './lib/parse-products-csv';

async function main() {
  const csvPath =
    process.env.PRODUCTS_CSV?.trim() || defaultProductsCsvPath();
  const { rows, warnings } = parseProductsCsv(csvPath);

  for (const w of warnings) {
    console.warn(`[import-products] ${w}`);
  }

  const prisma = new PrismaClient();
  try {
    const vendorIdByName = new Map<string, number>();
    const vendorNames = [...new Set(rows.map((r) => r.vendorName))].sort();
    for (const name of vendorNames) {
      const existing = await prisma.vendor.findFirst({
        where: { name, deletedAt: null },
      });
      const vendor =
        existing ??
        (await prisma.vendor.create({
          data: { name },
        }));
      vendorIdByName.set(name, vendor.id);
    }

    let created = 0;
    let updated = 0;
    for (const row of rows) {
      const vendorId = vendorIdByName.get(row.vendorName);
      if (!vendorId) {
        throw new Error(`Vendor not found: ${row.vendorName}`);
      }
      const existing = await prisma.rmCode.findFirst({
        where: { code: row.code },
      });
      if (existing) {
        await prisma.rmCode.update({
          where: { id: existing.id },
          data: {
            name: row.name,
            vendorId,
            prodArea: row.prodArea || null,
            deletedAt: null,
          },
        });
        updated++;
      } else {
        await prisma.rmCode.create({
          data: {
            code: row.code,
            name: row.name,
            vendorId,
            prodArea: row.prodArea || null,
          },
        });
        created++;
      }
    }

    console.log(
      `[import-products] ${vendorNames.length} vendors, ${rows.length} RM codes (${created} created, ${updated} updated) from ${csvPath}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
