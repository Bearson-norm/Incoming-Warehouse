import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const USER_CONFIG_DIR = path.join(os.homedir(), '.incoming-warehouse-gateway');
const USER_CONFIG_FILE = path.join(USER_CONFIG_DIR, 'config.json');

/**
 * Writable config path for Gateway (Electron packaged app runs from Program Files).
 * Never write config.json under process.cwd() when installed via NSIS.
 */
export function resolveGatewayConfigPath(): string {
  if (process.env.GATEWAY_CONFIG_PATH) {
    return process.env.GATEWAY_CONFIG_PATH;
  }

  if (!fs.existsSync(USER_CONFIG_DIR)) {
    fs.mkdirSync(USER_CONFIG_DIR, { recursive: true });
  }

  if (!fs.existsSync(USER_CONFIG_FILE)) {
    const bundledCandidates = [
      path.join(process.cwd(), 'config.json'),
      path.join(process.cwd(), '..', 'config.json'),
    ];
    for (const bundled of bundledCandidates) {
      if (fs.existsSync(bundled)) {
        try {
          fs.copyFileSync(bundled, USER_CONFIG_FILE);
          break;
        } catch {
          // Bundled path may be read-only; seed defaults below
        }
      }
    }
  }

  return USER_CONFIG_FILE;
}

export function getUserGatewayConfigDir(): string {
  return USER_CONFIG_DIR;
}
