#!/usr/bin/env node

/**
 * macOS Notarization Script
 * Notarizes the app after signing (required for macOS 10.15+)
 */

const { notarize } = require('@electron/notarize');
const path = require('path');
const fs = require('fs');

async function notarizeApp() {
  const appPath = process.env.APP_PATH;
  
  if (!appPath) {
    console.log('APP_PATH not set, skipping notarization');
    return;
  }

  if (!fs.existsSync(appPath)) {
    console.error(`App not found at: ${appPath}`);
    process.exit(1);
  }

  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !appleIdPassword || !teamId) {
    console.log('Apple credentials not configured, skipping notarization');
    console.log('Set APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and APPLE_TEAM_ID');
    return;
  }

  console.log(`Notarizing ${path.basename(appPath)}...`);
  console.log(`This may take several minutes...`);

  try {
    await notarize({
      appPath,
      appleId,
      appleIdPassword,
      teamId,
      tool: 'notarytool',
    });

    console.log('✓ Notarization successful!');
  } catch (error) {
    console.error('✗ Notarization failed:', error.message);
    process.exit(1);
  }
}

notarizeApp().catch(console.error);
