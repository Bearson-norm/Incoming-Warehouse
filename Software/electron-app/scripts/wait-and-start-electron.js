#!/usr/bin/env node
/**
 * Waits for Vite (Dashboard web) on port 4234, then starts Electron dev.
 * Used with: concurrently "npm run dev:web" "node electron-app/scripts/wait-and-start-electron.js"
 *
 * Important: Do NOT run `npm run dev:api` at the same time — Electron starts the API child process itself.
 */

const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn, execSync } = require('child_process');

const rootPath = path.resolve(__dirname, '../..');
const electronAppDir = path.join(rootPath, 'electron-app');
const apiPath = path.join(rootPath, 'Dashboard', 'api');

function resolveApiMainFile() {
  const candidates = [
    path.join(apiPath, 'dist', 'main.js'),
    path.join(apiPath, 'dist', 'src', 'main.js'),
    path.join(apiPath, 'src', 'main.js'),
    path.join(apiPath, 'main.js'),
  ];
  return candidates.find((p) => fs.existsSync(p));
}

function ensureApiBuild() {
  let apiMainFile = resolveApiMainFile();
  if (apiMainFile) {
    return apiMainFile;
  }

  console.log('[Electron] API build belum ada; building once...');
  execSync('npm run build', {
    cwd: apiPath,
    stdio: 'inherit',
  });
  apiMainFile = resolveApiMainFile();
  if (!apiMainFile) {
    throw new Error('API build completed but dist/src/main.js (or dist/main.js) was not created.');
  }
  return apiMainFile;
}

function sqlitePrismaClientIsCurrent() {
  const sourceSchema = path.join(apiPath, 'prisma-sqlite', 'schema.prisma');
  const generatedCandidates = [
    path.join(apiPath, 'node_modules', '.prisma', 'client', 'schema.prisma'),
    path.join(rootPath, 'node_modules', '.prisma', 'client', 'schema.prisma'),
  ];
  const generatedSchema = generatedCandidates.find((candidate) =>
    fs.existsSync(candidate)
  );
  if (!generatedSchema || !fs.existsSync(sourceSchema)) {
    return false;
  }

  const generated = fs.readFileSync(generatedSchema, 'utf8');
  const usesSqlite = /datasource\s+\w+\s*\{[\s\S]*?provider\s*=\s*"sqlite"/m.test(
    generated
  );
  return (
    usesSqlite &&
    fs.statSync(generatedSchema).mtimeMs >= fs.statSync(sourceSchema).mtimeMs
  );
}

const MAX_WAIT_MS = 120000;
const POLL_MS = 400;

const VITE_PORT = 4234;
const VITE_HOSTS = ['127.0.0.1', 'localhost', '::1'];

function checkHostPort(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const finish = (ok) => {
      socket.removeAllListeners();
      try {
        socket.destroy();
      } catch (_) {
        /* ignore */
      }
      resolve(ok);
    };

    socket.setTimeout(1500, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

async function checkViteReady() {
  for (const host of VITE_HOSTS) {
    if (await checkHostPort(host, VITE_PORT)) {
      return true;
    }
  }
  return false;
}

async function main() {
  try {
    ensureApiBuild();
  } catch (error) {
    console.error(`[Electron] API build failed: ${error.message}`);
    process.exit(1);
  }

  if (sqlitePrismaClientIsCurrent()) {
    console.log('[Electron] SQLite Prisma client is current; skipping generation.');
  } else {
    try {
      console.log('[Electron] Generating SQLite Prisma client for the local device...');
      execSync('npm run prisma:generate:sqlite', {
        cwd: apiPath,
        stdio: 'inherit',
      });
    } catch (error) {
      console.error('[Electron] prisma:generate:sqlite failed. SQLite API will not start.');
      process.exit(1);
    }
  }

  const start = Date.now();
  process.stdout.write(`[Electron] Menunggu Vite di port ${VITE_PORT} ...`);

  while (Date.now() - start < MAX_WAIT_MS) {
    if (await checkViteReady()) {
      console.log('\n[Vite] siap, menjalankan Electron...\n');
      const child = spawn('npm', ['run', 'dev'], {
        cwd: electronAppDir,
        shell: true,
        stdio: 'inherit',
        env: { ...process.env },
      });

      const forward = () => {
        try {
          child.kill('SIGINT');
        } catch (_) {
          /* ignore */
        }
      };
      process.on('SIGINT', forward);
      process.on('SIGTERM', forward);

      child.on('exit', (code, signal) => {
        process.off('SIGINT', forward);
        process.off('SIGTERM', forward);
        if (signal) process.kill(process.pid, signal);
        process.exit(code ?? 0);
      });
      return;
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
    process.stdout.write('.');
  }

  console.error(
    `\n[Electron] Timeout (${MAX_WAIT_MS / 1000}s) menunggu Vite. Pastikan port 4234 bebas.`
  );
  process.exit(1);
}

main();
