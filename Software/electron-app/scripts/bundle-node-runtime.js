#!/usr/bin/env node
/**
 * Bundles official Node.js Windows x64 into node-runtime/win-x64/ for electron-builder extraResources.
 * Packaged apps then spawn API/Gateway without requiring Node.js installed on the target PC.
 *
 * Uses the same semver as the Node running this script (native modules in api/gateway match that ABI).
 * Override: NODE_BUNDLE_WIN_VERSION=20.18.1
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');
const os = require('os');

const WIN_ARCH = 'x64';
const VERSION = process.env.NODE_BUNDLE_WIN_VERSION || process.version.slice(1);

const ELECTRON_APP_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ELECTRON_APP_ROOT, 'node-runtime', `win-${WIN_ARCH}`);

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    function get(u) {
      https
        .get(u, (res) => {
          if (res.statusCode >= 301 && res.statusCode <= 308 && res.headers.location) {
            res.resume();
            get(new URL(res.headers.location, u).href);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode} for ${u}`));
            return;
          }
          const file = fs.createWriteStream(dest);
          res.pipe(file);
          file.on('finish', () => file.close(() => resolve()));
        })
        .on('error', reject);
    }
    get(url);
  });
}

function extractZip(zipPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  if (process.platform === 'win32') {
    const z = zipPath.replace(/'/g, "''");
    const d = destDir.replace(/'/g, "''");
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${z}' -DestinationPath '${d}' -Force"`,
      { stdio: 'inherit' }
    );
  } else {
    execSync(`unzip -o -q "${zipPath}" -d "${destDir}"`, { stdio: 'inherit' });
  }
}

async function main() {
  const zipName = `node-v${VERSION}-win-${WIN_ARCH}.zip`;
  const url = `https://nodejs.org/dist/v${VERSION}/${zipName}`;
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-node-'));
  const zipPath = path.join(tmpRoot, zipName);
  const extractRoot = path.join(tmpRoot, 'extract');

  console.log('[bundle-node] Bundling Node', VERSION, 'win-' + WIN_ARCH);
  console.log('[bundle-node] Download:', url);

  try {
    await downloadFile(url, zipPath);
  } catch (e) {
    console.error('[bundle-node] Download failed:', e.message);
    console.error(
      '  Tip: set NODE_BUNDLE_WIN_VERSION to a published version from https://nodejs.org/dist/ (same major as your API build).'
    );
    process.exit(1);
  }

  fs.mkdirSync(extractRoot, { recursive: true });
  extractZip(zipPath, extractRoot);

  const nested = path.join(extractRoot, `node-v${VERSION}-win-${WIN_ARCH}`);
  if (!fs.existsSync(nested)) {
    console.error('[bundle-node] Expected folder missing:', nested);
    process.exit(1);
  }

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(OUT_DIR), { recursive: true });
  fs.cpSync(nested, OUT_DIR, { recursive: true });

  const nodeExe = path.join(OUT_DIR, 'node.exe');
  if (!fs.existsSync(nodeExe)) {
    console.error('[bundle-node] node.exe not found after extract');
    process.exit(1);
  }

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  console.log('[bundle-node] OK →', OUT_DIR);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
