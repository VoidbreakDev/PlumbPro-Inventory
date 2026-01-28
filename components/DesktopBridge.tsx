import { useState, useEffect, useCallback } from 'react';

// Type definitions for Electron API
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

interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  getPlatform: () => string;
  getArch: () => string;
  getServerPort: () => Promise<number>;
  restartServer: () => Promise<number>;
  checkForUpdates: () => Promise<any>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  getUpdateStatus: () => Promise<UpdateStatus>;
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => void;
  onUpdateAvailable: (callback: (info: any) => void) => void;
  onUpdateDownloaded: (callback: (info: any) => void) => void;
  onDownloadProgress: (callback: (progress: any) => void) => void;
  onUpdateError: (callback: (error: string) => void) => void;
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  showSaveDialog: (options: any) => Promise<any>;
  showOpenDialog: (options: any) => Promise<any>;
  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    __PLUMBPRO_SERVER_PORT__?: number;
  }
}

/**
 * Check if running in Electron desktop environment
 */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setIsDesktop(typeof window !== 'undefined' && !!window.electronAPI);
  }, []);

  return isDesktop;
}

/**
 * Get desktop app information
 */
export function useDesktopInfo() {
  const isDesktop = useIsDesktop();
  const [version, setVersion] = useState<string | null>(null);
  const [platform, setPlatform] = useState<string | null>(null);

  useEffect(() => {
    if (!isDesktop || !window.electronAPI) return;

    window.electronAPI.getAppVersion().then(setVersion);
    setPlatform(window.electronAPI.getPlatform());
  }, [isDesktop]);

  return {
    isDesktop,
    version,
    platform,
    isWindows: platform === 'win32',
    isMac: platform === 'darwin',
    isLinux: platform === 'linux'
  };
}

/**
 * Hook for managing desktop auto-updates
 */
export function useDesktopUpdates() {
  const isDesktop = useIsDesktop();
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
    checking: false,
    available: false,
    downloading: false,
    downloaded: false,
    error: null,
    progress: 0,
    version: null,
    releaseNotes: null
  });

  useEffect(() => {
    if (!isDesktop || !window.electronAPI) return;

    // Listen for update status changes
    window.electronAPI.onUpdateStatus((status) => {
      setUpdateStatus(status);
    });

    // Get initial status
    window.electronAPI.getUpdateStatus().then(setUpdateStatus);

    return () => {
      window.electronAPI?.removeAllListeners('update-status');
    };
  }, [isDesktop]);

  const checkForUpdates = useCallback(() => {
    if (!isDesktop || !window.electronAPI) return;
    window.electronAPI.checkForUpdates();
  }, [isDesktop]);

  const downloadUpdate = useCallback(() => {
    if (!isDesktop || !window.electronAPI) return;
    window.electronAPI.downloadUpdate();
  }, [isDesktop]);

  const installUpdate = useCallback(() => {
    if (!isDesktop || !window.electronAPI) return;
    window.electronAPI.installUpdate();
  }, [isDesktop]);

  return {
    isDesktop,
    updateStatus,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    hasUpdate: updateStatus.available,
    isDownloading: updateStatus.downloading,
    isReady: updateStatus.downloaded,
    downloadProgress: updateStatus.progress,
    updateVersion: updateStatus.version,
    updateError: updateStatus.error
  };
}

/**
 * Component to display update notification banner
 */
export function UpdateNotificationBanner() {
  const {
    isDesktop,
    hasUpdate,
    isDownloading,
    isReady,
    downloadProgress,
    updateVersion,
    downloadUpdate,
    installUpdate
  } = useDesktopUpdates();

  if (!isDesktop) return null;

  // Show update available banner
  if (hasUpdate && !isDownloading && !isReady) {
    return (
      <div className="bg-blue-600 text-white px-4 py-2 flex items-center justify-between">
        <span>
          A new version ({updateVersion}) is available!
        </span>
        <button
          onClick={downloadUpdate}
          className="ml-4 px-3 py-1 bg-white text-blue-600 rounded text-sm font-medium hover:bg-blue-50"
        >
          Download Update
        </button>
      </div>
    );
  }

  // Show downloading progress
  if (isDownloading) {
    return (
      <div className="bg-blue-600 text-white px-4 py-2">
        <div className="flex items-center justify-between mb-1">
          <span>Downloading update...</span>
          <span>{downloadProgress}%</span>
        </div>
        <div className="w-full bg-blue-400 rounded-full h-1.5">
          <div
            className="bg-white h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${downloadProgress}%` }}
          />
        </div>
      </div>
    );
  }

  // Show ready to install banner
  if (isReady) {
    return (
      <div className="bg-green-600 text-white px-4 py-2 flex items-center justify-between">
        <span>
          Update ready! Restart to install version {updateVersion}.
        </span>
        <button
          onClick={installUpdate}
          className="ml-4 px-3 py-1 bg-white text-green-600 rounded text-sm font-medium hover:bg-green-50"
        >
          Restart Now
        </button>
      </div>
    );
  }

  return null;
}

/**
 * Hook for native file dialogs
 */
export function useNativeDialogs() {
  const isDesktop = useIsDesktop();

  const showSaveDialog = useCallback(async (options: {
    title?: string;
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }) => {
    if (!isDesktop || !window.electronAPI) {
      // Fallback for web: use download attribute
      return { canceled: true, filePath: undefined };
    }
    return window.electronAPI.showSaveDialog(options);
  }, [isDesktop]);

  const showOpenDialog = useCallback(async (options: {
    title?: string;
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
    properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>;
  }) => {
    if (!isDesktop || !window.electronAPI) {
      // Fallback for web: use input[type="file"]
      return { canceled: true, filePaths: [] };
    }
    return window.electronAPI.showOpenDialog(options);
  }, [isDesktop]);

  return {
    isDesktop,
    showSaveDialog,
    showOpenDialog
  };
}

export default {
  useIsDesktop,
  useDesktopInfo,
  useDesktopUpdates,
  useNativeDialogs,
  UpdateNotificationBanner
};
