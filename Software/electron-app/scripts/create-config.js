#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const electronAppDir = path.resolve(__dirname, '..');
const CONFIG_FILE = path.join(electronAppDir, 'config.json');

const DEFAULT_CONFIG = {
  jwtSecret: '',
  gatewayApiKey: '',
  adminInitialPassword: '',
  gateway: {
    enabled: true,
    autoStart: false,
  },
  odoo: {
    baseUrl: '',
    iotApiKey: '',
  },
};

if (!fs.existsSync(CONFIG_FILE)) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
  console.log(`Created default config file: ${CONFIG_FILE}`);
} else {
  console.log(`Config file already exists: ${CONFIG_FILE}`);
}

  console.log('\nLocal devices use SQLite automatically (incoming-warehouse.db next to the exe).');
  console.log('Configure Odoo WMS via Settings in the Electron app UI.');
