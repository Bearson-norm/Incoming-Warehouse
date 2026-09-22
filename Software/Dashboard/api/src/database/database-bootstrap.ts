import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { isSqliteDatabaseUrl } from '../common/runtime-secrets';

const INITIAL_SQLITE_MIGRATION = '20260918100000_init_sqlite';
const CLOUD_SCALE_SQLITE_MIGRATION = '20260918140000_cloud_scale_local';

type SqliteNameRow = { name: string };
type SqliteColumnRow = { name: string };
type MigrationRow = {
  migration_name: string;
  finished_at: Date | string | null;
  rolled_back_at: Date | string | null;
};

function resolveSqliteFilePath(databaseUrl: string): string | null {
  if (!databaseUrl.startsWith('file:')) {
    return null;
  }
  let filePath = databaseUrl.slice('file:'.length);
  const queryIndex = filePath.indexOf('?');
  if (queryIndex >= 0) {
    filePath = filePath.slice(0, queryIndex);
  }
  try {
    filePath = decodeURIComponent(filePath);
  } catch {
    // keep raw path
  }
  // file:///C:/data/app.db  → C:/data/app.db  (Windows; avoid C:\C:\...)
  filePath = filePath.replace(/^\/\/\/+/, '');
  filePath = filePath.replace(/^\/\/localhost\//i, '');
  filePath = filePath.replace(/^\/+([A-Za-z]:)/, '$1');
  return path.resolve(filePath);
}

function resolvePrismaSchema(cwd: string, databaseUrl: string): string | undefined {
  if (!isSqliteDatabaseUrl(databaseUrl)) {
    return undefined;
  }
  const candidates = [
    path.join(cwd, 'prisma-sqlite', 'schema.prisma'),
    path.join(cwd, 'prisma', 'schema.prisma'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function runPrismaMigrationCommand(
  prismaCli: string,
  cwd: string,
  schemaPath: string | undefined,
  args: string[],
): void {
  const commandArgs = [prismaCli, ...args];
  if (schemaPath) {
    commandArgs.push('--schema', schemaPath);
  }
  execFileSync(process.execPath, commandArgs, {
    cwd,
    env: process.env,
    stdio: 'inherit',
  });
}

async function getSqliteTableNames(prisma: PrismaClient): Promise<Set<string>> {
  const rows = await prisma.$queryRawUnsafe<SqliteNameRow[]>(
    "SELECT name FROM sqlite_master WHERE type = 'table'",
  );
  return new Set(rows.map((row) => row.name));
}

async function getSqliteColumns(
  prisma: PrismaClient,
  tableName: 'WeighSession' | 'WeighReading',
): Promise<Set<string>> {
  const rows = await prisma.$queryRawUnsafe<SqliteColumnRow[]>(
    `PRAGMA table_info("${tableName}")`,
  );
  return new Set(rows.map((row) => row.name));
}

async function addSqliteColumnIfMissing(
  prisma: PrismaClient,
  tableName: 'WeighSession' | 'WeighReading',
  columns: Set<string>,
  columnName: string,
  definition: string,
): Promise<void> {
  if (columns.has(columnName)) {
    return;
  }
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${definition}`,
  );
  columns.add(columnName);
}

async function upgradeLegacySqliteSchema(
  prisma: PrismaClient,
  tables: Set<string>,
): Promise<void> {
  if (!tables.has('RmCode')) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "RmCode" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "code" TEXT NOT NULL,
        "name" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL
      )
    `);
    tables.add('RmCode');
  }

  const sessionColumns = await getSqliteColumns(prisma, 'WeighSession');
  await addSqliteColumnIfMissing(
    prisma,
    'WeighSession',
    sessionColumns,
    'rmCodeId',
    'INTEGER',
  );
  await addSqliteColumnIfMissing(
    prisma,
    'WeighSession',
    sessionColumns,
    'gatewayId',
    'TEXT',
  );
  await addSqliteColumnIfMissing(
    prisma,
    'WeighSession',
    sessionColumns,
    'weighingMethod',
    "TEXT NOT NULL DEFAULT 'odoo'",
  );
  await addSqliteColumnIfMissing(
    prisma,
    'WeighSession',
    sessionColumns,
    'flowType',
    "TEXT NOT NULL DEFAULT 'incoming'",
  );
  await addSqliteColumnIfMissing(
    prisma,
    'WeighSession',
    sessionColumns,
    'scaleId',
    'INTEGER',
  );
  await addSqliteColumnIfMissing(
    prisma,
    'WeighSession',
    sessionColumns,
    'scaleName',
    'TEXT',
  );

  const readingColumns = await getSqliteColumns(prisma, 'WeighReading');
  await addSqliteColumnIfMissing(
    prisma,
    'WeighReading',
    readingColumns,
    'cloudSyncedAt',
    'DATETIME',
  );
  await addSqliteColumnIfMissing(
    prisma,
    'WeighReading',
    readingColumns,
    'cloudSyncError',
    'TEXT',
  );

  const indexes = [
    'CREATE UNIQUE INDEX IF NOT EXISTS "RmCode_code_key" ON "RmCode"("code")',
    'CREATE INDEX IF NOT EXISTS "WeighSession_packageUid_idx" ON "WeighSession"("packageUid")',
    'CREATE INDEX IF NOT EXISTS "WeighSession_gatewayId_idx" ON "WeighSession"("gatewayId")',
    'CREATE INDEX IF NOT EXISTS "WeighSession_scaleId_idx" ON "WeighSession"("scaleId")',
    'CREATE INDEX IF NOT EXISTS "WeighSession_userId_endedAt_idx" ON "WeighSession"("userId", "endedAt")',
    'CREATE INDEX IF NOT EXISTS "WeighSession_weighingMethod_idx" ON "WeighSession"("weighingMethod")',
    'CREATE INDEX IF NOT EXISTS "WeighSession_flowType_idx" ON "WeighSession"("flowType")',
    'CREATE INDEX IF NOT EXISTS "WeighReading_sessionId_idx" ON "WeighReading"("sessionId")',
    'CREATE INDEX IF NOT EXISTS "WeighReading_capturedAt_idx" ON "WeighReading"("capturedAt")',
    'CREATE INDEX IF NOT EXISTS "WeighReading_packageUid_idx" ON "WeighReading"("packageUid")',
    'CREATE INDEX IF NOT EXISTS "WeighReading_cloudSyncedAt_idx" ON "WeighReading"("cloudSyncedAt")',
    'CREATE UNIQUE INDEX IF NOT EXISTS "Gateway_gatewayId_key" ON "Gateway"("gatewayId")',
    'CREATE UNIQUE INDEX IF NOT EXISTS "Gateway_apiKey_key" ON "Gateway"("apiKey")',
    'CREATE INDEX IF NOT EXISTS "Gateway_gatewayId_idx" ON "Gateway"("gatewayId")',
  ];
  for (const statement of indexes) {
    await prisma.$executeRawUnsafe(statement);
  }
}

async function getAppliedMigrations(
  prisma: PrismaClient,
  tables: Set<string>,
): Promise<MigrationRow[]> {
  if (!tables.has('_prisma_migrations')) {
    return [];
  }
  return prisma.$queryRawUnsafe<MigrationRow[]>(
    'SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"',
  );
}

function migrationWasApplied(rows: MigrationRow[], migrationName: string): boolean {
  return rows.some(
    (row) =>
      row.migration_name === migrationName &&
      row.finished_at !== null &&
      row.rolled_back_at === null,
  );
}

/**
 * Databases created by older builds used `prisma db push`, so they already
 * contain the application schema but have no migration history. Baselining
 * prevents `migrate deploy` from trying to recreate those tables.
 */
async function baselineLegacySqliteDatabase(
  prismaCli: string,
  cwd: string,
  schemaPath: string,
): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const tables = await getSqliteTableNames(prisma);
    const legacyCoreTables = [
      'User',
      'Vendor',
      'Packaging',
      'WeighSession',
      'WeighReading',
      'Gateway',
    ];
    if (!legacyCoreTables.every((table) => tables.has(table))) {
      return;
    }

    await upgradeLegacySqliteSchema(prisma, tables);

    let migrations = await getAppliedMigrations(prisma, tables);
    if (!migrationWasApplied(migrations, INITIAL_SQLITE_MIGRATION)) {
      console.log('[db-bootstrap] Baselining existing SQLite schema...');
      runPrismaMigrationCommand(prismaCli, cwd, schemaPath, [
        'migrate',
        'resolve',
        '--applied',
        INITIAL_SQLITE_MIGRATION,
      ]);
    }

    const sessionColumns = await getSqliteColumns(prisma, 'WeighSession');
    const readingColumns = await getSqliteColumns(prisma, 'WeighReading');
    migrations = await getAppliedMigrations(
      prisma,
      await getSqliteTableNames(prisma),
    );
    const cloudScaleSchemaExists =
      sessionColumns.has('scaleId') &&
      sessionColumns.has('scaleName') &&
      readingColumns.has('cloudSyncedAt') &&
      readingColumns.has('cloudSyncError');

    if (
      cloudScaleSchemaExists &&
      !migrationWasApplied(migrations, CLOUD_SCALE_SQLITE_MIGRATION)
    ) {
      runPrismaMigrationCommand(prismaCli, cwd, schemaPath, [
        'migrate',
        'resolve',
        '--applied',
        CLOUD_SCALE_SQLITE_MIGRATION,
      ]);
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function sqliteMigrationsAreCurrent(
  schemaPath: string,
): Promise<boolean> {
  const migrationsDir = path.join(path.dirname(schemaPath), 'migrations');
  const expectedMigrations = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        fs.existsSync(path.join(migrationsDir, entry.name, 'migration.sql')),
    )
    .map((entry) => entry.name);

  const prisma = new PrismaClient();
  try {
    const tables = await getSqliteTableNames(prisma);
    const applied = await getAppliedMigrations(prisma, tables);
    return expectedMigrations.every((migrationName) =>
      migrationWasApplied(applied, migrationName),
    );
  } finally {
    await prisma.$disconnect();
  }
}

async function seedDefaultData(prisma: PrismaClient): Promise<void> {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    return;
  }

  const isProd = process.env.NODE_ENV === 'production';
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD?.trim();

  if (!adminPassword) {
    if (isProd) {
      console.warn(
        '[db-bootstrap] No users and ADMIN_INITIAL_PASSWORD is unset. Skipping seed.',
      );
      return;
    }
  }

  const password = adminPassword || 'admin123';
  console.log('[db-bootstrap] Seeding default admin user...');

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      username: 'admin',
      passwordHash,
      role: 'admin',
    },
  });

  const vendor = await prisma.vendor.create({
    data: { name: 'Sample Vendor' },
  });

  await prisma.packaging.create({
    data: {
      vendorId: vendor.id,
      name: 'Box Small',
      tareWeight: 0.5,
      metadata: JSON.stringify({ size: 'small', type: 'box' }),
    },
  });

  console.log('[db-bootstrap] Default admin user created (username: admin).');
}

export async function bootstrapDatabase(): Promise<void> {
  const cwd = process.cwd();
  const databaseUrl = process.env.DATABASE_URL?.trim() || '';
  const sqlite = isSqliteDatabaseUrl(databaseUrl);

  if (sqlite) {
    const dbFile = resolveSqliteFilePath(databaseUrl);
    if (!dbFile) {
      throw new Error('Invalid SQLite DATABASE_URL');
    }
    const dbDir = path.dirname(dbFile);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  }

  const prismaCli = path.join(cwd, 'node_modules', 'prisma', 'build', 'index.js');
  if (!fs.existsSync(prismaCli)) {
    throw new Error(
      `Prisma CLI not found at ${prismaCli}. Rebuild the API package before running.`,
    );
  }

  const schemaPath = resolvePrismaSchema(cwd, databaseUrl);
  const engine = sqlite ? 'SQLite' : 'PostgreSQL';

  if (sqlite && schemaPath) {
    await baselineLegacySqliteDatabase(prismaCli, cwd, schemaPath);
  }

  const migrationsCurrent =
    sqlite && schemaPath
      ? await sqliteMigrationsAreCurrent(schemaPath)
      : false;

  if (migrationsCurrent) {
    console.log('[db-bootstrap] SQLite migrations are already current.');
  } else {
    console.log(`[db-bootstrap] Applying ${engine} migrations...`);
    runPrismaMigrationCommand(prismaCli, cwd, schemaPath, [
      'migrate',
      'deploy',
    ]);
  }

  const prisma = new PrismaClient();
  try {
    await seedDefaultData(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
