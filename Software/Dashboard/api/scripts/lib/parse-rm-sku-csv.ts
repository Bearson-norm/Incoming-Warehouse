import * as fs from 'fs';
import * as path from 'path';

export type RmSkuRow = {
  code: string;
  name: string;
};

export function defaultRmSkuCsvPath(): string {
  const bundled = path.resolve(process.cwd(), 'data/rm-sku-inbound.csv');
  const repoRoot = path.resolve(
    process.cwd(),
    '../../../Macro Inbound RMPM Batch V.5 (TER UPDATE) (6).csv',
  );
  if (fs.existsSync(bundled)) return bundled;
  return repoRoot;
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      fields.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  fields.push(current);
  return fields;
}

function detectDelimiter(headerLine: string): ';' | ',' {
  const semi = headerLine.split(';').length;
  const comma = headerLine.split(',').length;
  return semi >= comma ? ';' : ',';
}

/**
 * Parses inbound RM master CSV: columns RM CODE (or code) and SKU (name).
 * Deduplicates by code; warns when the same code maps to different names.
 */
export function parseRmSkuCsv(filePath: string): {
  rows: RmSkuRow[];
  warnings: string[];
  skippedBlank: number;
} {
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  const lines = raw.split(/\r?\n/);
  const warnings: string[] = [];
  let skippedBlank = 0;

  if (lines.length < 2) {
    return { rows: [], warnings: ['CSV is empty'], skippedBlank: 0 };
  }

  const delimiter = detectDelimiter(lines[0]);
  const header = parseDelimitedLine(lines[0], delimiter).map((h) =>
    h.trim().toLowerCase(),
  );

  const codeIdx = header.findIndex(
    (h) => h === 'rm code' || h === 'code' || h === 'kode rm',
  );
  const nameIdx = header.findIndex(
    (h) => h === 'sku' || h === 'name' || h === 'nama sku' || h === 'nama',
  );

  if (codeIdx < 0 || nameIdx < 0) {
    throw new Error(
      `Expected columns "RM CODE" and "SKU" (delimiter ${delimiter}); got: ${lines[0]}`,
    );
  }

  const byCode = new Map<string, string>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      skippedBlank++;
      continue;
    }
    const cols = parseDelimitedLine(line, delimiter);
    const code = (cols[codeIdx] ?? '').trim();
    const name = (cols[nameIdx] ?? '').trim();
    if (!code) {
      warnings.push(`Line ${i + 1}: missing RM code`);
      continue;
    }
    if (!name) {
      warnings.push(`Line ${i + 1}: missing SKU name for ${code}`);
      continue;
    }
    const prev = byCode.get(code);
    if (prev !== undefined && prev !== name) {
      warnings.push(
        `Line ${i + 1}: duplicate code ${code} with different name ("${prev}" vs "${name}"); keeping first`,
      );
      continue;
    }
    if (prev === undefined) {
      byCode.set(code, name);
    }
  }

  const rows = [...byCode.entries()]
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.code.localeCompare(b.code));

  return { rows, warnings, skippedBlank };
}
