import { fork, ChildProcess } from 'child_process';
import path from 'path';
import { app } from 'electron';
import log from 'electron-log';
import portfinder from 'portfinder';

let serverProcess: ChildProcess | null = null;
let currentPort: number = 5000;
let isShuttingDown: boolean = false;

/**
 * Start the embedded Express server as a child process
 */
export async function startEmbeddedServer(): Promise<number> {
  if (serverProcess) {
    log.warn('Server already running, stopping first...');
    await stopEmbeddedServer();
  }

  // Find an available port starting from 5000
  portfinder.basePort = 5000;
  try {
    currentPort = await portfinder.getPortPromise();
  } catch (error) {
    log.error('Failed to find available port:', error);
    currentPort = 5000; // Fallback to default
  }

  log.info(`Starting embedded server on port ${currentPort}...`);

  // Determine server path based on packaged state
  const serverPath = app.isPackaged
    ? path.join(process.resourcesPath, 'server', 'src', 'server.js')
    : path.join(__dirname, '../../server/src/server.js');

  log.info(`Server path: ${serverPath}`);

  // Environment variables for the server
  const serverEnv: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: String(currentPort),
    NODE_ENV: app.isPackaged ? 'production' : 'development',
    // Use the user data directory for logs and uploads
    LOG_DIR: path.join(app.getPath('userData'), 'logs'),
    UPLOAD_DIR: path.join(app.getPath('userData'), 'uploads'),
    // Disable interactive prompts
    FORCE_COLOR: '0',
    NO_UPDATE_NOTIFIER: '1'
  };

  return new Promise((resolve, reject) => {
    try {
      serverProcess = fork(serverPath, [], {
        env: serverEnv,
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        cwd: app.isPackaged
          ? path.join(process.resourcesPath, 'server')
          : path.join(__dirname, '../../server')
      });

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

      // Handle IPC messages from server
      serverProcess.on('message', (message: any) => {
        log.info('[Server IPC]', message);
        if (message.type === 'ready') {
          resolve(currentPort);
        }
      });

      // Handle process errors
      serverProcess.on('error', (error: Error) => {
        log.error('Server process error:', error);
        if (!isShuttingDown) {
          reject(error);
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
