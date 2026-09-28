import * as fs from 'fs';
import * as path from 'path';

export type ParsedTareRow = {
  supplierName: string;
  packagingName: string;
  grossWeightGr: number;
  tareWeightGr: number;
};

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

export function defaultTareCsvPath(): string {
  return path.resolve(process.cwd(), 'data/standar-tare-jerrycan.csv');
}

export function parseTareJerrycanCsv(filePath: string): ParsedTareRow[] {
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  const lines = raw.split(/\r?\n/);
  if (lines.length < 2) {
    return [];
  }

  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const supplierIdx = header.findIndex(
    (h) => h.toLowerCase().includes('supplier') || h === 'Nama Supplier',
  );
  const typeIdx = header.findIndex(
    (h) => h.toLowerCase().includes('jerigen') || h === 'Jenis Jerigen',
  );
  const grossIdx = header.findIndex((h) =>
    h.toLowerCase().includes('bruto'),
  );
  const tareIdx = header.findIndex((h) => h.toLowerCase().includes('tare'));

  if (
    supplierIdx < 0 ||
    typeIdx < 0 ||
    grossIdx < 0 ||
    tareIdx < 0
  ) {
    throw new Error(
      'Expected columns: Nama Supplier, Jenis Jerigen, Standar Bruto (gr), Standar Tare (gr)',
    );
  }

  const rows: ParsedTareRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = parseCsvLine(line);
    const supplierName = (cols[supplierIdx] ?? '').trim();
    const packagingName = (cols[typeIdx] ?? '').trim();
    if (!supplierName || !packagingName) continue;

    const grossWeightGr = Number(String(cols[grossIdx] ?? '').replace(/,/g, ''));
    const tareWeightGr = Number(String(cols[tareIdx] ?? '').replace(/,/g, ''));
    if (Number.isNaN(grossWeightGr) || Number.isNaN(tareWeightGr)) {
      throw new Error(`Invalid weights on line ${i + 1}: ${line}`);
    }

    rows.push({
      supplierName,
      packagingName,
      grossWeightGr,
      tareWeightGr,
    });
  }
  return rows;
}
