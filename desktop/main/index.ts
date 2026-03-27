import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import path from 'path';
import { startEmbeddedServer, stopEmbeddedServer, getServerPort } from '../server/embedded';
import { configureAutoUpdater, checkForUpdates, downloadUpdate, installUpdate, getUpdateStatus, isUpdateInstallInProgress } from './updater';
import { createWindow, getMainWindow } from './window';
import { setupMenu } from './menu';

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = 'debug';
autoUpdater.logger = log;

// Store server port
let serverPort: number = 5001;

// App startup
async function initialize(): Promise<void> {
  log.info('PlumbPro Inventory Desktop starting...');
  log.info(`App version: ${app.getVersion()}`);
  log.info(`Electron version: ${process.versions.electron}`);
  log.info(`Node version: ${process.versions.node}`);
  log.info(`Platform: ${process.platform} ${process.arch}`);

  // Start embedded server first
  try {
    log.info('About to start embedded server...');
    serverPort = await startEmbeddedServer();
    log.info(`Embedded server started on port ${serverPort}`);
  } catch (error: any) {
    log.error('Failed to start embedded server:', error);
    log.error('Error message:', error?.message || 'Unknown error');
    log.error('Error stack:', error?.stack || 'No stack trace');
    dialog.showErrorBox(
      'Server Error',
      `Failed to start the application server.\n\nError: ${error?.message || 'Unknown error'}\n\nPlease check the logs and try again.`
    );
    // Don't continue if server failed to start
    return;
  }

  // Setup application menu
  setupMenu();

  // Create main window
  const mainWindow = await createWindow(serverPort);

  // Configure auto-updater
  configureAutoUpdater(mainWindow, {
    beforeInstall: async () => {
      log.info('Preparing application for update install...');
      await stopEmbeddedServer();
    }
  });

  // Check for updates after window is ready (only in production)
  if (!app.isPackaged) {
    log.info('Development mode - skipping auto-update check');
  } else {
    mainWindow.webContents.on('did-finish-load', () => {
      setTimeout(() => {
        checkForUpdates();
      }, 3000); // Delay update check by 3 seconds
    });
  }
}

// Setup IPC handlers
function setupIPC(): void {
  // App info
  ipcMain.handle('get-app-version', () => app.getVersion());
  ipcMain.handle('get-server-port', () => getServerPort());

  // Update handlers
  ipcMain.handle('check-for-updates', () => checkForUpdates());
  ipcMain.handle('download-update', () => downloadUpdate());
  ipcMain.handle('install-update', () => installUpdate());
  ipcMain.handle('get-update-status', () => getUpdateStatus());

  // Window controls
  ipcMain.on('window-minimize', () => {
    const win = getMainWindow();
    win?.minimize();
  });

  ipcMain.on('window-maximize', () => {
    const win = getMainWindow();
    if (win?.isMaximized()) {
      win.unmaximize();
    } else {
      win?.maximize();
    }
  });

  ipcMain.on('window-close', () => {
    const win = getMainWindow();
    win?.close();
  });

  // Native dialogs
  ipcMain.handle('show-save-dialog', async (_, options) => {
    const win = getMainWindow();
    if (!win) return { canceled: true };
    return dialog.showSaveDialog(win, options);
  });

  ipcMain.handle('show-open-dialog', async (_, options) => {
    const win = getMainWindow();
    if (!win) return { canceled: true };
    return dialog.showOpenDialog(win, options);
  });

  // Restart server
  ipcMain.handle('restart-server', async () => {
    log.info('Restarting embedded server...');
    await stopEmbeddedServer();
    serverPort = await startEmbeddedServer();
    return serverPort;
  });
}

// App lifecycle events
app.whenReady().then(async () => {
  setupIPC();
  await initialize();

  // macOS: Re-create window when dock icon is clicked
  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow(serverPort);
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', async () => {
  log.info('All windows closed');
  if (!isUpdateInstallInProgress()) {
    await stopEmbeddedServer();
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Cleanup before quit
app.on('before-quit', async (event) => {
  log.info('Application quitting...');
  if (getUpdateStatus().downloaded && !isUpdateInstallInProgress()) {
    log.info('Downloaded update detected during quit, switching to install flow...');
    event.preventDefault();
    await installUpdate();
    return;
  }

  if (!isUpdateInstallInProgress()) {
    await stopEmbeddedServer();
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log.error('Uncaught exception:', error);
  dialog.showErrorBox('Error', `An unexpected error occurred: ${error.message}`);
});

process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled rejection at:', promise, 'reason:', reason);
});

// Export for testing
export { serverPort };
