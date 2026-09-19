import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { resolveGatewayConfigPath } from '../config-path.js';

// Optional import for better-sqlite3 - will be loaded dynamically if available
type Database = any;

/**
 * Config Store menggunakan SQLite untuk menyimpan konfigurasi gateway
 * Fallback ke file JSON jika SQLite tidak tersedia
 */
export class ConfigStore {
  private db: Database | null = null;
  private configPath: string;
  private useSqlite: boolean;

  constructor(configPath?: string, useSqlite: boolean = true) {
    this.configPath = configPath || resolveGatewayConfigPath();
    this.useSqlite = useSqlite;

    if (useSqlite) {
      this.initSqlite();
    }
  }

  private initSqlite() {
    try {
      // Dynamic import of better-sqlite3 - only loads if available
      const Database = require('better-sqlite3');
      const dbPath = path.join(os.homedir(), '.incoming-warehouse-gateway.db');
      this.db = new Database(dbPath);
      
      // Create config table if not exists
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS config (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        );
        
        CREATE TABLE IF NOT EXISTS config_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT NOT NULL,
          old_value TEXT,
          new_value TEXT,
          updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        );
      `);
    } catch (error) {
      console.warn('SQLite not available, falling back to JSON config:', error);
      this.useSqlite = false;
    }
  }

  get<T = any>(key: string, defaultValue?: T): T | undefined {
    if (this.useSqlite && this.db) {
      try {
        const row = this.db.prepare('SELECT value FROM config WHERE key = ?').get(key) as { value: string } | undefined;
        if (row) {
          return JSON.parse(row.value) as T;
        }
      } catch (error) {
        console.warn(`Error reading config key ${key} from SQLite:`, error);
      }
    }

    // Fallback to JSON file
    return this.getFromJson<T>(key, defaultValue);
  }

  set<T = any>(key: string, value: T): void {
    const valueStr = JSON.stringify(value);

    if (this.useSqlite && this.db) {
      try {
        const stmt = this.db.prepare('INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, strftime("%s", "now"))');
        const oldValue = this.get(key);
        
        stmt.run(key, valueStr);
        
        // Log history
        if (oldValue !== undefined) {
          const historyStmt = this.db.prepare(
            'INSERT INTO config_history (key, old_value, new_value) VALUES (?, ?, ?)'
          );
          historyStmt.run(key, JSON.stringify(oldValue), valueStr);
        }
        return;
      } catch (error) {
        console.warn(`Error writing config key ${key} to SQLite:`, error);
      }
    }

    // Fallback to JSON file
    this.setToJson(key, value);
  }

  getAll(): Record<string, any> {
    if (this.useSqlite && this.db) {
      try {
        const rows = this.db.prepare('SELECT key, value FROM config').all() as Array<{ key: string; value: string }>;
        const config: Record<string, any> = {};
        rows.forEach(row => {
          config[row.key] = JSON.parse(row.value);
        });
        return config;
      } catch (error) {
        console.warn('Error reading all config from SQLite:', error);
      }
    }

    // Fallback to JSON file
    return this.getAllFromJson();
  }

  private getFromJson<T = any>(key: string, defaultValue?: T): T | undefined {
    try {
      if (fs.existsSync(this.configPath)) {
        const config = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
        return config[key] !== undefined ? config[key] : defaultValue;
      }
    } catch (error) {
      console.warn(`Error reading config from JSON:`, error);
    }
    return defaultValue;
  }

  private setToJson<T = any>(key: string, value: T): void {
    try {
      let config: Record<string, any> = {};
      if (fs.existsSync(this.configPath)) {
        config = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
      }
      config[key] = value;
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error) {
      console.error(`Error writing config to JSON:`, error);
    }
  }

  private getAllFromJson(): Record<string, any> {
    try {
      if (fs.existsSync(this.configPath)) {
        return JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
      }
    } catch (error) {
      console.warn('Error reading config from JSON:', error);
    }
    return {};
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
