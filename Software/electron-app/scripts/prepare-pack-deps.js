#!/usr/bin/env node
/**
 * Install API/Gateway node_modules locally before electron-builder packaging.
 * Workspace hoisting leaves Dashboard/api/node_modules empty — packaged API then crashes.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '../..');
const apiPath = path.join(root, 'Dashboard', 'api');
const gatewayPath = path.join(root, 'Gateway', 'app');

function run(command, cwd) {
  console.log(`\n> ${command}`);
  console.log(`  (in ${cwd})`);
  execSync(command, {
    cwd,
    stdio: 'inherit',
    env: process.env,
    shell: true,
  });
}

function assertPackagingReady() {
  const apiPrisma = path.join(apiPath, 'node_modules', '@prisma', 'client');
  const gatewayMain = path.join(gatewayPath, 'dist', 'index.js');
  const apiMain = path.join(apiPath, 'dist', 'src', 'main.js');

  if (!fs.existsSync(apiMain)) {
    throw new Error(`API not built: missing ${apiMain}. Run npm run build:api first.`);
  }
  if (!fs.existsSync(gatewayMain)) {
    throw new Error(`Gateway not built: missing ${gatewayMain}. Run npm run build:gateway first.`);
  }
  if (!fs.existsSync(apiPrisma)) {
    throw new Error(
      `API node_modules incomplete (missing @prisma/client). ` +
        `Run: cd Dashboard/api && npm install --workspaces=false && npm run prisma:generate:sqlite`
    );
  }

  const apiModuleCount = fs.readdirSync(path.join(apiPath, 'node_modules')).length;
  if (apiModuleCount < 20) {
    throw new Error(
      `API node_modules looks too small (${apiModuleCount} entries). ` +
        'Hoisted workspace install is not enough for the packaged app.'
    );
  }

  console.log('\n[prepare-pack-deps] API and Gateway dependencies ready for packaging.');
}

console.log('[prepare-pack-deps] Installing local node_modules for Electron extraResources...');

run('npm install --workspaces=false --omit=dev', apiPath);
run('npm run prisma:generate:sqlite', apiPath);
run('npm install --workspaces=false --omit=dev', gatewayPath);

assertPackagingReady();
