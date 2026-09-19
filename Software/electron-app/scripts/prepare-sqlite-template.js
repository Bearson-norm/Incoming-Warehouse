#!/usr/bin/env node
/**
 * Build a ready-to-use SQLite file with the default admin login.
 * Copied into the installer and onto first launch / Setup.exe.
 */

const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const apiPath = path.resolve(__dirname, '../../Dashboard/api');
const outDir = path.resolve(__dirname, '../resources/data');
const dbFile = path.join(outDir, 'incoming-warehouse.db');
const adminPassword = process.env.ADMIN_INITIAL_PASSWORD?.trim() || 'admin123';

fs.mkdirSync(outDir, { recursive: true });
for (const suffix of ['', '-journal', '-wal', '-shm']) {
  const target = `${dbFile}${suffix}`;
  if (fs.existsSync(target)) {
    fs.unlinkSync(target);
  }
}

const databaseUrl = `file:${dbFile.replace(/\\/g, '/')}`;
const schema = path.join(apiPath, 'prisma-sqlite', 'schema.prisma');
if (!fs.existsSync(schema)) {
  throw new Error(`Missing ${schema}`);
}

console.log('[sqlite-template] Generating SQLite Prisma client...');
execSync('npm run prisma:generate:sqlite', {
  cwd: apiPath,
  stdio: 'inherit',
  env: process.env,
  shell: true,
});

console.log('[sqlite-template] Applying migrations to', dbFile);
execSync(`npx prisma migrate deploy --schema "${schema}"`, {
  cwd: apiPath,
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: databaseUrl },
  shell: true,
});

const seedFile = path.join(__dirname, 'seed-sqlite-template.js');
console.log('[sqlite-template] Injecting admin user...');
const seeded = spawnSync(process.execPath, [seedFile], {
  cwd: apiPath,
  stdio: 'inherit',
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl,
    ADMIN_INITIAL_PASSWORD: adminPassword,
  },
});
if (seeded.status !== 0) {
  throw new Error('Failed to seed SQLite template');
}

if (!fs.existsSync(dbFile) || fs.statSync(dbFile).size < 1024) {
  throw new Error(`SQLite template was not created: ${dbFile}`);
}

fs.writeFileSync(
  path.join(outDir, 'login.txt'),
  `Incoming Warehouse\r\nUsername: admin\r\nPassword: ${adminPassword}\r\n`,
  'utf-8',
);

console.log('[sqlite-template] Ready:', dbFile);
