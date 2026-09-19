#!/usr/bin/env node
/**
 * Stage API + Gateway with full node_modules for electron-builder extraResources.
 * electron-builder copies Dashboard/api/node_modules as-is; if hoisted/empty, packaged API crashes.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '../..');
const electronAppPath = path.join(root, 'electron-app');
const apiPath = path.join(root, 'Dashboard', 'api');
const gatewayPath = path.join(root, 'Gateway', 'app');
const stagingRoot = path.join(electronAppPath, 'staging');

function run(command, cwd) {
  console.log(`\n> ${command}`);
  console.log(`  (in ${cwd})`);
  execSync(command, { cwd, stdio: 'inherit', env: process.env, shell: true });
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`Missing path: ${src}`);
  }
  fs.cpSync(src, dest, { recursive: true, force: true });
}

function assertDirHasModules(dir, label, options) {
  const { minCount, requiredPkg } = options;
  const nm = path.join(dir, 'node_modules');
  const requiredPath = path.join(nm, ...requiredPkg.split('/'));
  if (!fs.existsSync(requiredPath)) {
    throw new Error(`${label}: missing node_modules/${requiredPkg} in ${nm}`);
  }
  const count = fs.readdirSync(nm).filter((n) => !n.startsWith('.')).length;
  if (count < minCount) {
    throw new Error(`${label}: node_modules too small (${count} entries) in ${nm}`);
  }
  console.log(`[stage] ${label}: ${count} packages in node_modules`);
}

console.log('[stage-electron-resources] Preparing staging folder for packaging...');

run('node scripts/prepare-pack-deps.js', electronAppPath);

const apiDist = path.join(apiPath, 'dist', 'src', 'main.js');
const gatewayDist = path.join(gatewayPath, 'dist', 'index.js');
if (!fs.existsSync(path.join(apiPath, 'prisma-sqlite', 'schema.prisma'))) {
  throw new Error('Missing Dashboard/api/prisma-sqlite/schema.prisma (required for local SQLite)');
}
if (!fs.existsSync(apiDist)) {
  throw new Error(`Build API first: missing ${apiDist}`);
}
if (!fs.existsSync(gatewayDist)) {
  throw new Error(`Build Gateway first: missing ${gatewayDist}`);
}

if (fs.existsSync(stagingRoot)) {
  fs.rmSync(stagingRoot, { recursive: true, force: true });
}

const stageApi = path.join(stagingRoot, 'api');
const stageGateway = path.join(stagingRoot, 'gateway');

fs.mkdirSync(stageApi, { recursive: true });
fs.mkdirSync(stageGateway, { recursive: true });

const generatedSchema = path.join(apiPath, 'node_modules', '.prisma', 'client', 'schema.prisma');
if (!fs.existsSync(generatedSchema) || !fs.readFileSync(generatedSchema, 'utf8').includes('provider = "sqlite"')) {
  throw new Error(
    'Packaged Prisma client must be generated from prisma-sqlite. ' +
      'Run: cd Dashboard/api && npm run prisma:generate:sqlite',
  );
}

console.log('[stage] Copying API dist + node_modules + SQLite prisma...');
copyDir(path.join(apiPath, 'dist'), stageApi);
copyDir(path.join(apiPath, 'node_modules'), path.join(stageApi, 'node_modules'));
copyDir(path.join(apiPath, 'prisma-sqlite'), path.join(stageApi, 'prisma'));

console.log('[stage] Restoring PostgreSQL Prisma client for VPS / local API...');
try {
  run('npm run prisma:generate', apiPath);
} catch (error) {
  console.warn('[stage] Could not restore PostgreSQL Prisma client:', error.message);
}

console.log('[stage] Copying Gateway dist + node_modules...');
copyDir(path.join(gatewayPath, 'dist'), stageGateway);
copyDir(path.join(gatewayPath, 'node_modules'), path.join(stageGateway, 'node_modules'));

assertDirHasModules(stageApi, 'API', { minCount: 20, requiredPkg: '@nestjs/core' });
assertDirHasModules(stageGateway, 'Gateway', { minCount: 5, requiredPkg: 'serialport' });

console.log('\n[stage-electron-resources] Staging OK:', stagingRoot);
