#!/usr/bin/env node
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

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

  try {
    await esbuild.build({
      entryPoints: ['./src/server.js'],
      bundle: true,
      platform: 'node',
      target: 'node20',
      outfile: 'dist/server.bundle.mjs',  // ESM format
      format: 'esm',  // Use ESM for top-level await support
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

    // Copy better-sqlite3 native module
    const betterSqlite3Path = path.dirname(require.resolve('better-sqlite3/package.json'));
    const buildPath = path.join(betterSqlite3Path, 'build');
    if (fs.existsSync(buildPath)) {
      fs.cpSync(buildPath, 'dist/node_modules/better-sqlite3/build', { recursive: true });
      console.log('Copied: better-sqlite3 native bindings');
    }

    // Copy better-sqlite3 package.json and main file
    fs.cpSync(
      path.join(betterSqlite3Path, 'lib'),
      'dist/node_modules/better-sqlite3/lib',
      { recursive: true }
    );
    fs.copyFileSync(
      path.join(betterSqlite3Path, 'package.json'),
      'dist/node_modules/better-sqlite3/package.json'
    );

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
