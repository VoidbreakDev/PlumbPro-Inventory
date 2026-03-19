#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function prepare() {
  console.log('Preparing bundled server for desktop...');

  execSync('node bundle.cjs', {
    cwd: __dirname,
    stdio: 'inherit',
    env: { ...process.env }
  });

  const distDir = path.join(__dirname, 'dist');
  const bundlePath = path.join(distDir, 'server.bundle.mjs');

  if (!fs.existsSync(bundlePath)) {
    throw new Error(`Expected bundled server at ${bundlePath}`);
  }

  console.log('✓ Desktop server prepared successfully in dist/');
}

prepare().catch((error) => {
  console.error('Failed:', error);
  process.exit(1);
});
