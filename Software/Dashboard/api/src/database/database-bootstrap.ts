import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { isSqliteDatabaseUrl } from '../common/runtime-secrets';

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
  const schemaArg = schemaPath ? ` --schema "${schemaPath}"` : '';
  const engine = sqlite ? 'SQLite' : 'PostgreSQL';
  console.log(`[db-bootstrap] Applying ${engine} migrations...`);
  execSync(`node "${prismaCli}" migrate deploy${schemaArg}`, {
    cwd,
    env: process.env,
    stdio: 'inherit',
  });

  const prisma = new PrismaClient();
  try {
    await seedDefaultData(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
