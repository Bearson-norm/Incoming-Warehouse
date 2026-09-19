import * as fs from 'fs';
import * as path from 'path';
import {
  ensurePortableDataDirectory,
  getSqliteDatabasePath,
  sqliteDatabaseExists,
} from './sqlite-path';

export interface DbConnectionTestResult {
  ok: boolean;
  error?: string;
  dbPath?: string;
  exists?: boolean;
  configured?: boolean;
}

/** Verify the SQLite folder is writable and the database file is accessible. */
export async function testSqliteDatabase(): Promise<DbConnectionTestResult> {
  const dbPath = getSqliteDatabasePath();
  try {
    ensurePortableDataDirectory();
    const dir = path.dirname(dbPath);
    fs.accessSync(dir, fs.constants.W_OK);
    if (sqliteDatabaseExists()) {
      fs.accessSync(dbPath, fs.constants.R_OK | fs.constants.W_OK);
    } else {
      const probe = path.join(dir, `.write-test-${process.pid}`);
      fs.writeFileSync(probe, 'ok', 'utf-8');
      fs.unlinkSync(probe);
    }
    return {
      ok: true,
      configured: true,
      dbPath,
      exists: sqliteDatabaseExists(),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      configured: true,
      error: `Folder database tidak bisa ditulis: ${msg}`,
      dbPath,
      exists: sqliteDatabaseExists(),
    };
  }
}
