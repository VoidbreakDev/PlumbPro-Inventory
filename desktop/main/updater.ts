import { autoUpdater, UpdateCheckResult, UpdateInfo } from 'electron-updater';
import { BrowserWindow, dialog, app } from 'electron';
import log from 'electron-log';

export interface UpdateStatus {
  checking: boolean;
  available: boolean;
  downloading: boolean;
  downloaded: boolean;
  error: string | null;
  progress: number;
  version: string | null;
  releaseNotes: string | null;
}

let updateStatus: UpdateStatus = {
  checking: false,
  available: false,
  downloading: false,
  downloaded: false,
  error: null,
  progress: 0,
  version: null,
  releaseNotes: null
};

let mainWindowRef: BrowserWindow | null = null;

export function configureAutoUpdater(mainWindow: BrowserWindow): void {
  mainWindowRef = mainWindow;

  // Configure updater settings
  autoUpdater.autoDownload = false; // Manual download control
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;

  // Set feed URL to use generic provider with GitHub latest release URL
  // This avoids the deprecated releases.atom endpoint that GitHub removed
  // GitHub redirects /releases/latest/download/ to the actual latest release
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: 'https://github.com/VoidbreakDev/PlumbPro-Inventory/releases/latest/download',
    channel: 'latest'
  });

  // For development testing, enable dev update config
  if (!app.isPackaged) {
    autoUpdater.forceDevUpdateConfig = true;
    autoUpdater.updateConfigPath = './dev-app-update.yml';
  }

  // Event: Checking for updates
  autoUpdater.on('checking-for-update', () => {
    log.info('Checking for updates...');
    updateStatus = {
      ...updateStatus,
      checking: true,
      error: null
    };
    sendStatusToWindow();
  });

  // Event: Update available
  autoUpdater.on('update-available', (info: UpdateInfo) => {
    log.info(`Update available: ${info.version}`);
    updateStatus = {
      ...updateStatus,
      checking: false,
      available: true,
      version: info.version,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : null
    };
    sendStatusToWindow();
    promptForUpdate(info);
  });

  // Event: No update available
  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    log.info(`No update available. Current version: ${info.version}`);
    updateStatus = {
      ...updateStatus,
      checking: false,
      available: false,
      version: info.version
    };
    sendStatusToWindow();
  });

  // Event: Download progress
  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(progress.percent);
    log.info(`Download progress: ${percent}%`);
    updateStatus = {
      ...updateStatus,
      downloading: true,
      progress: percent
    };
    sendStatusToWindow();

    // Update window progress bar (Windows/macOS)
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.setProgressBar(progress.percent / 100);
    }
  });

  // Event: Update downloaded
  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    log.info(`Update downloaded: ${info.version}`);
    updateStatus = {
      ...updateStatus,
      downloading: false,
      downloaded: true,
      progress: 100
    };
    sendStatusToWindow();

    // Clear progress bar
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.setProgressBar(-1);
    }

    promptForInstall(info);
  });

  // Event: Error
  autoUpdater.on('error', (error: Error) => {
    log.error('Update error:', error);
    updateStatus = {
      ...updateStatus,
      checking: false,
      downloading: false,
      error: error.message
    };
    sendStatusToWindow();

    // Clear progress bar on error
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.setProgressBar(-1);
    }
  });
}

function sendStatusToWindow(): void {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send('update-status', updateStatus);
  }
}

async function promptForUpdate(info: UpdateInfo): Promise<void> {
  if (!mainWindowRef || mainWindowRef.isDestroyed()) return;

  const result = await dialog.showMessageBox(mainWindowRef, {
    type: 'info',
    title: 'Update Available',
    message: `A new version of PlumbPro Inventory is available!`,
    detail: `Version ${info.version} is ready to download.\n\nWould you like to download it now? The update will be installed when you restart the app.`,
    buttons: ['Download Now', 'Later'],
    defaultId: 0,
    cancelId: 1
  });

  if (result.response === 0) {
    downloadUpdate();
  }
}

async function promptForInstall(info: UpdateInfo): Promise<void> {
  if (!mainWindowRef || mainWindowRef.isDestroyed()) return;

  const result = await dialog.showMessageBox(mainWindowRef, {
    type: 'info',
    title: 'Update Ready',
    message: `Version ${info.version} has been downloaded`,
    detail: 'The update will be installed when you restart the application.\n\nWould you like to restart now?',
    buttons: ['Restart Now', 'Later'],
    defaultId: 0,
    cancelId: 1
  });

  if (result.response === 0) {
    installUpdate();
  }
}

export async function checkForUpdates(): Promise<UpdateCheckResult | null> {
  try {
    log.info('Manually checking for updates...');
    return await autoUpdater.checkForUpdates();
  } catch (error) {
    log.error('Failed to check for updates:', error);
    updateStatus = {
      ...updateStatus,
      checking: false,
      error: (error as Error).message
    };
    sendStatusToWindow();
    return null;
  }
}

export function downloadUpdate(): void {
  log.info('Starting update download...');
  updateStatus = {
    ...updateStatus,
    downloading: true,
    progress: 0
  };
  sendStatusToWindow();
  autoUpdater.downloadUpdate();
}

export function installUpdate(): void {
  log.info('Installing update and restarting...');
  autoUpdater.quitAndInstall(false, true);
}

export function getUpdateStatus(): UpdateStatus {
  return updateStatus;
}
