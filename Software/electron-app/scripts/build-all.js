#!/usr/bin/env node

/**
 * Script to build all components before packaging Electron app
 * 1. Build Gateway
 * 2. Build Dashboard API
 * 3. Build Dashboard Web
 * 4. Build Electron app
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootPath = path.resolve(__dirname, '../..');

function runCommand(command, cwd = rootPath) {
  console.log(`\n> ${command}`);
  console.log(`  (in ${cwd})`);
  try {
    execSync(command, {
      cwd,
      stdio: 'inherit',
      env: process.env,
    });
    return true;
  } catch (error) {
    console.error(`\n✗ Command failed: ${command}`);
    return false;
  }
}

async function buildAll() {
  console.log('🚀 Building all components for Electron app...\n');

  // 0. Install dependencies if needed
  console.log('📦 Step 0/5: Checking dependencies...');
  const gatewayPath = path.join(rootPath, 'Gateway/app');
  const apiPath = path.join(rootPath, 'Dashboard/api');
  const webPath = path.join(rootPath, 'Dashboard/web');
  const electronAppPath = path.join(rootPath, 'electron-app');

  if (!fs.existsSync(path.join(electronAppPath, 'node_modules'))) {
    console.log('  Installing Electron app dependencies...');
    if (!runCommand('npm install', electronAppPath)) {
      console.error('✗ Electron app dependencies installation failed');
      process.exit(1);
    }
  }

  const requireApiDeps = () =>
    fs.existsSync(path.join(apiPath, 'node_modules', '@nestjs', 'core'));
  const requireGatewayDeps = () =>
    fs.existsSync(path.join(gatewayPath, 'node_modules'));

  if (!requireGatewayDeps()) {
    console.log('  Installing Gateway node_modules locally (electron-builder extraResources)...');
    if (!runCommand('npm install --workspaces=false', gatewayPath)) {
      console.error('✗ Gateway dependencies installation failed');
      process.exit(1);
    }
  }

  if (!requireApiDeps()) {
    console.log('  Installing API node_modules locally (electron-builder extraResources)...');
    if (!runCommand('npm install --workspaces=false', apiPath)) {
      console.error('✗ API dependencies installation failed');
      process.exit(1);
    }
  }

  if (!requireApiDeps()) {
    console.error('✗ API node_modules incomplete (@nestjs/core missing). Run npm install in Dashboard/api.');
    process.exit(1);
  }
  
  if (!fs.existsSync(path.join(webPath, 'node_modules'))) {
    console.log('  Installing Web dependencies...');
    if (!runCommand('npm install', webPath)) {
      console.error('✗ Web dependencies installation failed');
      process.exit(1);
    }
  }

  // 1. Build Gateway
  console.log('\n📦 Step 1/5: Building Gateway...');
  if (!runCommand('npm run build', gatewayPath)) {
    console.error('✗ Gateway build failed');
    process.exit(1);
  }

  // 2. Build Dashboard API
  console.log('\n📦 Step 2/5: Building Dashboard API...');
  if (!runCommand('npm run build', apiPath)) {
    console.error('✗ Dashboard API build failed');
    process.exit(1);
  }

  // Generate Prisma client
  console.log('\n📦 Step 2.5/5: Generating Prisma client...');
  // Clear Prisma cache first to avoid EPERM errors on Windows
  const prismaCachePaths = [
    path.join(rootPath, 'Dashboard/api/node_modules/.prisma'),
    path.join(rootPath, 'node_modules/.prisma'),
  ];

  prismaCachePaths.forEach((cachePath) => {
    if (fs.existsSync(cachePath)) {
      try {
        console.log(`  Clearing Prisma cache: ${cachePath}`);
        fs.rmSync(cachePath, { recursive: true, force: true });
      } catch (error) {
        console.warn(`  Warning: Could not clear cache at ${cachePath}:`, error.message);
      }
    }
  });

  // Wait a bit for file locks to release
  await new Promise(resolve => setTimeout(resolve, 1000));

  if (!runCommand('npm run prisma:generate:sqlite', path.join(rootPath, 'Dashboard/api'))) {
    console.error('✗ Prisma SQLite client generation failed');
    console.error('  Tip: Make sure no API server is running and try again');
    process.exit(1);
  }

  // 3. Build Dashboard Web (with ELECTRON=true for relative asset paths)
  console.log('\n📦 Step 3/5: Building Dashboard Web...');
  if (!runCommand('npm run build:electron', webPath)) {
    console.error('✗ Dashboard Web build failed');
    process.exit(1);
  }

  // 3.5 Stage API/Gateway with full node_modules for electron-builder
  console.log('\n📦 Step 3.5/5: Staging resources for packaging...');
  if (!runCommand('node scripts/stage-electron-resources.js', electronAppPath)) {
    console.error('✗ stage-electron-resources failed');
    process.exit(1);
  }

  // Restore PostgreSQL Prisma client for VPS / local API after Electron staging copied the SQLite client.
  console.log('\n📦 Step 3.6/5: Restoring PostgreSQL Prisma client for VPS API...');
  runCommand('npm run prisma:generate', path.join(rootPath, 'Dashboard/api'));

  // 4. Build Electron app
  console.log('\n📦 Step 4/5: Building Electron app...');
  if (!runCommand('npm run build', path.join(rootPath, 'electron-app'))) {
    console.error('✗ Electron app build failed');
    process.exit(1);
  }

  console.log('\n✅ All components built successfully!');
  console.log('\n📦 Ready to package Electron app:');
  console.log('   cd electron-app && npm run package');
  console.log('\n💡 Note: Make sure all dist folders exist before packaging.');
}

// Run the build
buildAll().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
