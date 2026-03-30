#!/usr/bin/env node
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

function resolvePackageJson(packageName, searchPaths) {
  return require.resolve(`${packageName}/package.json`, { paths: searchPaths });
}

function copyPackage(packageName, searchPaths, distNodeModulesDir) {
  const packageJsonPath = resolvePackageJson(packageName, searchPaths);
  const packageRoot = path.dirname(packageJsonPath);
  const targetDir = path.join(distNodeModulesDir, packageName);

  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.cpSync(packageRoot, targetDir, { recursive: true });
}

async function bundle() {
  console.log('Bundling server...');
  
  // Ensure dist directory exists
  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist', { recursive: true });
  }

  // Ensure data directory exists
  if (!fs.existsSync('dist/data')) {
    fs.mkdirSync('dist/data', { recursive: true });
  }

  // Avoid stale runtime dependencies surviving between builds.
  fs.rmSync('dist/node_modules', { recursive: true, force: true });

  try {
    await esbuild.build({
      entryPoints: ['./src/server.js'],
      bundle: true,
      platform: 'node',
      target: 'node20',
      outfile: 'dist/server.bundle.mjs',  // ESM format
      format: 'esm',  // Use ESM for top-level await support
      banner: {
        js: 'import * as __plumbproModule from "module"; const require = __plumbproModule.createRequire(import.meta.url);'
      },
      external: [
        // Native modules - don't bundle these
        'better-sqlite3',
        'pg',
        'pg-native',
        // Dynamic imports
        'nodemailer-sendgrid-transport',
        'nodemailer-ses-transport',
        // Keep these as external for Electron
        'electron',
        'electron-updater',
        'electron-log'
      ],
      minify: false,
      sourcemap: false
    });

    // Copy required files
    const filesToCopy = [
      { from: '.env.example', to: 'dist/.env.example' },
      { from: 'migrations', to: 'dist/migrations' }
    ];

    for (const { from, to } of filesToCopy) {
      if (fs.existsSync(from)) {
        const stat = fs.statSync(from);
        if (stat.isDirectory()) {
          fs.cpSync(from, to, { recursive: true });
        } else {
          fs.copyFileSync(from, to);
        }
        console.log(`Copied: ${from} -> ${to}`);
      }
    }

    // Prefer the desktop app's rebuilt native module tree when available so
    // the embedded server uses Electron-compatible better-sqlite3 bindings.
    const packageSearchPaths = [
      path.join(__dirname, '../desktop'),
      __dirname
    ];
    const distNodeModulesDir = path.join(__dirname, 'dist/node_modules');
    for (const runtimePackage of ['better-sqlite3', 'bindings', 'file-uri-to-path']) {
      copyPackage(runtimePackage, packageSearchPaths, distNodeModulesDir);
    }
    const betterSqlite3Root = path.dirname(resolvePackageJson('better-sqlite3', packageSearchPaths));
    const betterSqlite3BuildDir = path.join(betterSqlite3Root, 'build');
    if (fs.existsSync(betterSqlite3BuildDir)) {
      fs.cpSync(
        betterSqlite3BuildDir,
        path.join(distNodeModulesDir, 'better-sqlite3/build'),
        { recursive: true }
      );
    }
    console.log('Copied: better-sqlite3 runtime dependencies');

    // Create a minimal package.json for the bundled server
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const minimalPackage = {
      name: packageJson.name,
      version: packageJson.version,
      main: 'server.bundle.mjs',
      type: 'module',
      dependencies: {
        'better-sqlite3': packageJson.dependencies['better-sqlite3'] || '^11.8.1'
      }
    };
    fs.writeFileSync('dist/package.json', JSON.stringify(minimalPackage, null, 2));

    console.log('✓ Server bundled successfully to dist/server.bundle.mjs');
    
    // Print bundle size
    const stats = fs.statSync('dist/server.bundle.mjs');
    console.log(`Bundle size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    
  } catch (error) {
    console.error('Bundle failed:', error);
    process.exit(1);
  }
}

bundle();
