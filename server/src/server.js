import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import pool from './config/database.js';
import { createApp } from './app.js';
import { startScheduler } from './scheduler.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = process.env.PORT || 5001;
const DEFAULT_NODE_ENV = process.env.NODE_ENV || 'development';
const DEFAULT_UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

function isMainModule() {
  const entryPoint = process.argv[1];
  if (!entryPoint) {
    return false;
  }

  return pathToFileURL(path.resolve(entryPoint)).href === import.meta.url;
}

export function createServer(options = {}) {
  const poolOverride = options.pool || pool;
  const nodeEnv = options.nodeEnv || DEFAULT_NODE_ENV;
  const uploadsDir = options.uploadsDir || DEFAULT_UPLOADS_DIR;
  const app = createApp({
    pool: poolOverride,
    nodeEnv,
    uploadsDir,
    corsOrigin: options.corsOrigin,
    rateLimitWindowMs: options.rateLimitWindowMs,
    rateLimitMaxRequests: options.rateLimitMaxRequests
  });

  return {
    app,
    pool: poolOverride,
    nodeEnv,
    port: options.port || DEFAULT_PORT
  };
}

export function startServer(options = {}) {
  const serverConfig = createServer(options);
  const notificationsEnabled = options.notificationsEnabled ?? process.env.ENABLE_NOTIFICATIONS !== 'false';
  const scheduler = startScheduler({
    pool: serverConfig.pool,
    enabled: notificationsEnabled,
    isDevelopment: serverConfig.nodeEnv === 'development'
  });

  const server = serverConfig.app.listen(serverConfig.port, '0.0.0.0', () => {
    console.log('');
    console.log('🚀 PlumbPro Inventory Server');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📡 Server running on port ${serverConfig.port}`);
    console.log(`🌍 Environment: ${serverConfig.nodeEnv}`);
    console.log(`🔗 API Base URL: http://localhost:${serverConfig.port}/api`);
    console.log(`❤️  Health Check: http://localhost:${serverConfig.port}/health`);
    console.log(`🔔 Notifications: ${notificationsEnabled ? 'Enabled' : 'Disabled'}`);
    console.log('🛡️  Security Headers: Enabled');
    console.log('⏱️  Rate Limiting: Enabled');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
  });

  return {
    ...serverConfig,
    scheduler,
    server
  };
}

if (isMainModule()) {
  try {
    startServer();
  } catch (error) {
    console.error('❌ Failed to start PlumbPro Inventory Server:', error);
    process.exit(1);
  }
}
