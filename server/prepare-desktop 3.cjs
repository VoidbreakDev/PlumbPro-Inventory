#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function prepare() {
  console.log('Preparing server for desktop...');
  
  const distDir = path.join(__dirname, 'dist-prod');
  
  // Clean and create dist directory
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true });
  }
  fs.mkdirSync(distDir, { recursive: true });
  fs.mkdirSync(path.join(distDir, 'data'), { recursive: true });
  
  // Copy source code
  fs.cpSync(path.join(__dirname, 'src'), path.join(distDir, 'src'), { recursive: true });
  
  // Copy essential files
  const filesToCopy = ['package.json', 'package-lock.json', '.env.example', 'migrations'];
  for (const file of filesToCopy) {
    const src = path.join(__dirname, file);
    const dest = path.join(distDir, file);
    if (fs.existsSync(src)) {
      const stat = fs.statSync(src);
      if (stat.isDirectory()) {
        fs.cpSync(src, dest, { recursive: true });
      } else {
        fs.copyFileSync(src, dest);
      }
      console.log(`Copied: ${file}`);
    }
  }
  
  // Install production dependencies
  console.log('Installing production dependencies...');
  try {
    execSync('npm install --omit=dev', {
      cwd: distDir,
      stdio: 'inherit',
      env: { ...process.env }
    });
  } catch (error) {
    console.error('npm install failed:', error);
    process.exit(1);
  }
  
  console.log('✓ Desktop server prepared successfully');
}

prepare().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
