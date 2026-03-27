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

interface AutoUpdaterOptions {
  beforeInstall?: () => Promise<void>;
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
let beforeInstallHandler: (() => Promise<void>) | null = null;
let installInProgress = false;

export function configureAutoUpdater(mainWindow: BrowserWindow, options: AutoUpdaterOptions = {}): void {
  mainWindowRef = mainWindow;
  beforeInstallHandler = options.beforeInstall ?? null;

  // Configure updater settings
  autoUpdater.autoDownload = false; // Manual download control
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowDowngrade = false;

  // Use GitHub provider with private token if available
  // electron-updater 6.x uses GitHub API instead of deprecated releases.atom
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'VoidbreakDev',
    repo: 'PlumbPro-Inventory',
    releaseType: 'release',
    vPrefixedTagName: true
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
    installInProgress = false;
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

export async function installUpdate(): Promise<void> {
  if (installInProgress) {
    log.info('Update install already in progress');
    return;
  }

  installInProgress = true;
  log.info('Installing update and restarting...');

  try {
    if (beforeInstallHandler) {
      log.info('Running pre-install shutdown tasks...');
      await beforeInstallHandler();
    }

    setImmediate(() => {
      autoUpdater.quitAndInstall(false, true);
    });
  } catch (error) {
    installInProgress = false;
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error('Failed to prepare update install:', error);
    updateStatus = {
      ...updateStatus,
      error: `Failed to install update: ${message}`
    };
    sendStatusToWindow();
  }
}

export function getUpdateStatus(): UpdateStatus {
  return updateStatus;
}

export function isUpdateInstallInProgress(): boolean {
  return installInProgress;
}
