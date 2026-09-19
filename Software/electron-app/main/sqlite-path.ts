import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export const SQLITE_DB_FILENAME = 'incoming-warehouse.db';

function directoryIsWritable(dir: string): boolean {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const probe = path.join(dir, `.iw-write-test-${process.pid}`);
    fs.writeFileSync(probe, 'ok', 'utf-8');
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

/** Directory next to the packaged exe (or electron-app root in dev). */
export function getPortableDataDirectory(): string {
  if (app.isPackaged) {
    const portableDir = process.env.PORTABLE_EXECUTABLE_DIR?.trim();
    if (portableDir && directoryIsWritable(portableDir)) {
      return portableDir;
    }
    const exeDir = path.dirname(app.getPath('exe'));
    if (directoryIsWritable(exeDir)) {
      return exeDir;
    }
    return app.getPath('userData');
  }
  return path.resolve(__dirname, '../..');
}

export function getSqliteDatabasePath(): string {
  return path.join(getPortableDataDirectory(), SQLITE_DB_FILENAME);
}

export function buildSqliteDatabaseUrl(dbFilePath: string): string {
  // Prisma on Windows accepts file:C:/path. Avoid file:///C:/... which some
  // parsers turn into C:\C:\... and fail mkdir.
  const normalized = path.resolve(dbFilePath).replace(/\\/g, '/');
  return `file:${normalized}`;
}

export function ensurePortableDataDirectory(): void {
  const dir = getPortableDataDirectory();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function sqliteDatabaseExists(): boolean {
  return fs.existsSync(getSqliteDatabasePath());
}
