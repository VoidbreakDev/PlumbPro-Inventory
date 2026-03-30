import { fork, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import log from 'electron-log';
import portfinder from 'portfinder';

let serverProcess: ChildProcess | null = null;
let currentPort: number = 5001;
let isShuttingDown: boolean = false;

/**
 * Start the embedded Express server as a child process
 */
export async function startEmbeddedServer(): Promise<number> {
  if (serverProcess) {
    log.warn('Server already running, stopping first...');
    await stopEmbeddedServer();
  }

  // Find an available port starting from 5001
  portfinder.basePort = 5001;
  try {
    currentPort = await portfinder.getPortPromise();
  } catch (error) {
    log.error('Failed to find available port:', error);
    currentPort = 5001; // Fallback to default
  }

  log.info(`Starting embedded server on port ${currentPort}...`);

  // Determine server path based on packaged state
  // In production, use the desktop server; in dev, use the source
  const serverPath = resolveServerPath();

  log.info(`Server path: ${serverPath}`);

  // Environment variables for the server
  const serverEnv: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: String(currentPort),
    NODE_ENV: app.isPackaged ? 'production' : 'development',
    // Use SQLite for standalone desktop app
    DB_TYPE: 'sqlite',
    SQLITE_PATH: path.join(app.getPath('userData'), 'data', 'plumbpro.db'),
    // JWT secret for authentication (generated per installation)
    JWT_SECRET: process.env.JWT_SECRET || 'plumbpro-desktop-' + app.getPath('userData').replace(/[^a-zA-Z0-9]/g, ''),
    // Use the user data directory for logs and uploads
    LOG_DIR: path.join(app.getPath('userData'), 'logs'),
    UPLOAD_DIR: path.join(app.getPath('userData'), 'uploads'),
    // Desktop runs as a local embedded app; skip server-side cron jobs.
    ENABLE_NOTIFICATIONS: 'false',
    // Disable interactive prompts
    FORCE_COLOR: '0',
    NO_UPDATE_NOTIFIER: '1'
  };

  // Ensure data directory exists
  const dataDir = path.join(app.getPath('userData'), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    try {
      log.info('Spawning server process...');
      const serverCwd = app.isPackaged
        ? path.join(process.resourcesPath, 'server')
        : path.join(__dirname, '../../server');
      log.info(`CWD: ${serverCwd}`);
      
      // Use fork to spawn the server as a Node.js process
      // In Electron, we need to set ELECTRON_RUN_AS_NODE to use Node.js mode
      log.info('Forking server process...');
      
      serverProcess = fork(serverPath, [], {
        env: { ...serverEnv, ELECTRON_RUN_AS_NODE: '1' },
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        cwd: serverCwd,
        execArgv: [] // Don't pass Electron flags to the forked process
      });
      
      log.info(`Server process spawned with PID: ${serverProcess.pid}`);

      // Handle stdout
      serverProcess.stdout?.on('data', (data: Buffer) => {
        const message = data.toString().trim();
        if (message) {
          log.info(`[Server] ${message}`);
        }
      });

      // Handle stderr
      serverProcess.stderr?.on('data', (data: Buffer) => {
        const message = data.toString().trim();
        if (message) {
          log.error(`[Server Error] ${message}`);
        }
      });

      // Server is considered ready after timeout (since we can't use IPC with spawn)
      setTimeout(() => {
        if (serverProcess && !serverProcess.killed) {
          log.info('Server assumed ready after startup timeout');
          resolve(currentPort);
        } else {
          log.error('Server process not running after timeout');
          reject(new Error('Server process exited before ready'));
        }
      }, 12000);  // Increased timeout to 12 seconds

      // Handle process errors
      serverProcess.on('error', (error: Error) => {
        log.error('Server process error:', error);
        console.error('Server process error:', error); // Also log to console
        if (!isShuttingDown) {
          reject(error);
        }
      });
      
      // Handle spawn errors
      serverProcess.on('spawn', () => {
        log.info('Server process spawned successfully');
      });
      
      // Handle exit immediately
      serverProcess.on('exit', (code: number | null, signal: string | null) => {
        log.error(`Server process exited early with code ${code}, signal ${signal}`);
        if (!isShuttingDown && code !== 0) {
          reject(new Error(`Server exited with code ${code}`));
        }
      });

      // Handle process exit
      serverProcess.on('exit', (code: number | null, signal: string | null) => {
        log.info(`Server process exited with code ${code}, signal ${signal}`);
        serverProcess = null;

        // Restart if unexpected exit (not during shutdown)
        if (!isShuttingDown && code !== 0) {
          log.warn('Server crashed, attempting restart in 2 seconds...');
          setTimeout(() => {
            if (!isShuttingDown) {
              startEmbeddedServer().catch(err => {
                log.error('Failed to restart server:', err);
              });
            }
          }, 2000);
        }
      });

      // Assume server is ready after timeout if no explicit message
      const startupTimeout = setTimeout(() => {
        if (serverProcess && !serverProcess.killed) {
          log.info('Server startup timeout reached, assuming ready');
          resolve(currentPort);
        }
      }, 10000);

      // Clear timeout if server sends ready message
      serverProcess.once('message', () => {
        clearTimeout(startupTimeout);
      });

    } catch (error) {
      log.error('Failed to fork server process:', error);
      reject(error);
    }
  });
}

/**
 * Stop the embedded server gracefully
 */
export async function stopEmbeddedServer(): Promise<void> {
  if (!serverProcess) {
    log.info('No server process to stop');
    return;
  }

  isShuttingDown = true;
  log.info('Stopping embedded server...');

  return new Promise((resolve) => {
    const killTimeout = setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        log.warn('Server did not exit gracefully, forcing kill...');
        serverProcess.kill('SIGKILL');
      }
      serverProcess = null;
      resolve();
    }, 5000);

    serverProcess.on('exit', () => {
      clearTimeout(killTimeout);
      serverProcess = null;
      isShuttingDown = false;
      log.info('Server stopped');
      resolve();
    });

    // Try graceful shutdown first
    try {
      serverProcess.send({ type: 'shutdown' });
    } catch {
      // If IPC fails, use SIGTERM
      serverProcess.kill('SIGTERM');
    }

    // Backup: Send SIGTERM after 2 seconds if still running
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        serverProcess.kill('SIGTERM');
      }
    }, 2000);
  });
}

/**
 * Get the current server port
 */
export function getServerPort(): number {
  return currentPort;
}

/**
 * Check if the server is running
 */
export function isServerRunning(): boolean {
  return serverProcess !== null && !serverProcess.killed;
}

/**
 * Restart the embedded server
 */
export async function restartServer(): Promise<number> {
  await stopEmbeddedServer();
  return startEmbeddedServer();
}

function resolveServerPath(): string {
  if (!app.isPackaged) {
    return path.join(__dirname, '../../server/src/server.js');
  }

  const packagedCandidates = [
    path.join(process.resourcesPath, 'server', 'server.bundle.mjs'),
    path.join(process.resourcesPath, 'server', 'server.bundle.cjs'),
    path.join(process.resourcesPath, 'server', 'src', 'server.js')
  ];

  const resolvedPath = packagedCandidates.find(candidate => fs.existsSync(candidate));
  return resolvedPath ?? packagedCandidates[0];
}
