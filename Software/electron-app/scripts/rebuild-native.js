#!/usr/bin/env node

/**
 * Script to rebuild native modules for Electron
 * This is needed for modules like serialport that have native bindings
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const electronVersion = require('electron/package.json').version;
const electronAbi = require('electron/package.json').abi || process.versions.modules;

console.log(`Rebuilding native modules for Electron ${electronVersion} (ABI: ${electronAbi})...`);

const projects = [
  {
    name: 'Gateway',
    path: path.resolve(__dirname, '../../Gateway/app'),
    modules: ['serialport', '@serialport/parser-readline'],
  },
];

projects.forEach((project) => {
  const projectPath = project.path;
  const packageJsonPath = path.join(projectPath, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    console.warn(`Skipping ${project.name}: package.json not found`);
    return;
  }

  console.log(`\nRebuilding native modules for ${project.name}...`);

  project.modules.forEach((moduleName) => {
    const modulePath = path.join(projectPath, 'node_modules', moduleName);

    if (!fs.existsSync(modulePath)) {
      console.warn(`  Module ${moduleName} not found, skipping...`);
      return;
    }

    try {
      console.log(`  Rebuilding ${moduleName}...`);
      execSync(
        `npm rebuild ${moduleName} --target=${electronVersion} --arch=x64 --disturl=https://electronjs.org/headers`,
        {
          cwd: projectPath,
          stdio: 'inherit',
          env: {
            ...process.env,
            npm_config_target: electronVersion,
            npm_config_arch: 'x64',
            npm_config_target_arch: 'x64',
            npm_config_disturl: 'https://electronjs.org/headers',
            npm_config_runtime: 'electron',
            npm_config_build_from_source: 'true',
          },
        }
      );
      console.log(`  ✓ ${moduleName} rebuilt successfully`);
    } catch (error) {
      console.error(`  ✗ Failed to rebuild ${moduleName}:`, error.message);
      // Continue with other modules
    }
  });
});

console.log('\n✓ Native module rebuild complete!');
