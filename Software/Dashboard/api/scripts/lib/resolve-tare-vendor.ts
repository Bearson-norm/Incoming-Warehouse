import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient, Vendor } from '@prisma/client';

export function normalizeVendorKey(name: string): string {
  return name
    .toUpperCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function loadAliases(): Record<string, string> {
  const aliasPath = path.resolve(
    process.cwd(),
    'data/vendor-tare-aliases.json',
  );
  if (!fs.existsSync(aliasPath)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(aliasPath, 'utf8')) as Record<
    string,
    string
  >;
}

function findByNormalizedName(
  vendors: Vendor[],
  target: string,
): Vendor | undefined {
  const key = normalizeVendorKey(target);
  return vendors.find((v) => normalizeVendorKey(v.name) === key);
}

function findFuzzy(vendors: Vendor[], supplierCsv: string): Vendor | undefined {
  const key = normalizeVendorKey(supplierCsv);
  const tokens = key.split(' ').filter((t) => t.length > 2);
  let best: Vendor | undefined;
  let bestScore = 0;
  for (const vendor of vendors) {
    const vKey = normalizeVendorKey(vendor.name);
    if (vKey.includes(key) || key.includes(vKey)) {
      return vendor;
    }
    const score = tokens.filter((t) => vKey.includes(t)).length;
    if (score > bestScore && score >= Math.min(2, tokens.length)) {
      bestScore = score;
      best = vendor;
    }
  }
  return best;
}

export async function resolveOrCreateTareVendor(
  prisma: PrismaClient,
  supplierCsv: string,
  vendorsCache: Vendor[],
): Promise<{ vendor: Vendor; created: boolean }> {
  const trimmed = supplierCsv.trim();
  const aliases = loadAliases();
  const aliasTarget = aliases[trimmed] ?? aliases[trimmed.replace(/\s+/g, ' ')];

  if (aliasTarget) {
    const existing = await prisma.vendor.findFirst({
      where: { name: aliasTarget, deletedAt: null },
    });
    if (existing) {
      return { vendor: existing, created: false };
    }
  }

  let match =
    vendorsCache.find((v) => v.name === trimmed && !v.deletedAt) ??
    findByNormalizedName(vendorsCache, trimmed) ??
    findFuzzy(vendorsCache, trimmed);

  if (match) {
    return { vendor: match, created: false };
  }

  const createName = aliasTarget ?? trimmed;
  const existingByName = await prisma.vendor.findFirst({
    where: { name: createName, deletedAt: null },
  });
  if (existingByName) {
    return { vendor: existingByName, created: false };
  }

  const created = await prisma.vendor.create({ data: { name: createName } });
  vendorsCache.push(created);
  return { vendor: created, created: true };
}
