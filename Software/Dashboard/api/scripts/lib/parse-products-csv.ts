import * as fs from 'fs';
import * as path from 'path';

export type ParsedProductRow = {
  code: string;
  name: string;
  prodArea: string;
  vendorName: string;
  productLine: string;
};

const CODE_TAIL =
  /^[A-Z][A-Z0-9][A-Z0-9]\d{3,5}$|^[A-Z]\d[A-Z]\d{3,5}$|^Q\d{5}$/;

export function extractRmCode(product: string): { code: string; name: string } {
  const trimmed = product.trim();
  const parts = trimmed.split(/\s+/);
  const last = parts[parts.length - 1] ?? '';
  if (parts.length > 1 && CODE_TAIL.test(last)) {
    const name = parts.slice(0, -1).join(' ').trim();
    return { code: last, name: name || trimmed };
  }
  return { code: trimmed, name: trimmed };
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  fields.push(current);
  return fields;
}

export function parseProductsCsv(filePath: string): {
  rows: ParsedProductRow[];
  warnings: string[];
} {
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  const lines = raw.split(/\r?\n/);
  if (lines.length < 2) {
    return { rows: [], warnings: ['CSV is empty'] };
  }

  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const productIdx = header.indexOf('Product');
  const typeIdx = header.indexOf('RM/PM/Others');
  const areaIdx = header.indexOf('Prod Area');
  const vendorIdx = header.indexOf('Vendor');
  if (
    productIdx < 0 ||
    typeIdx < 0 ||
    areaIdx < 0 ||
    vendorIdx < 0
  ) {
    throw new Error(
      'Expected columns: Product, RM/PM/Others, Prod Area, Vendor',
    );
  }

  const warnings: string[] = [];
  const byCode = new Map<string, ParsedProductRow>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = parseCsvLine(line);
    const productLine = (cols[productIdx] ?? '').trim();
    const type = (cols[typeIdx] ?? '').trim();
    if (type !== 'RM') continue;

    const { code, name } = extractRmCode(productLine);
    const prodArea = (cols[areaIdx] ?? '').trim();
    const vendorName = (cols[vendorIdx] ?? '').trim();
    if (!vendorName) {
      warnings.push(`Line ${i + 1}: missing vendor for ${productLine}`);
      continue;
    }

    const row: ParsedProductRow = {
      code,
      name,
      prodArea,
      vendorName,
      productLine,
    };

    const existing = byCode.get(code);
    if (existing) {
      const keep =
        row.name.length > existing.name.length ? row : existing;
      const drop = keep === row ? existing : row;
      warnings.push(
        `Duplicate code ${code}: kept "${keep.productLine}", dropped "${drop.productLine}"`,
      );
      byCode.set(code, keep);
    } else {
      byCode.set(code, row);
    }
  }

  const rows = [...byCode.values()].sort((a, b) =>
    a.code.localeCompare(b.code),
  );
  return { rows, warnings };
}

export function defaultProductsCsvPath(): string {
  return path.resolve(__dirname, '../../data/products-rm.csv');
}
