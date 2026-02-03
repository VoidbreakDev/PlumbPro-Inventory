import { contextBridge, ipcRenderer } from 'electron';

// Get server port from command line arguments (passed via additionalArguments)
const serverPortArg = process.argv.find(arg => arg.startsWith('--server-port='));
const serverPort = serverPortArg ? parseInt(serverPortArg.split('=')[1], 10) : 5001;

// Expose server port immediately on window object (before API calls are made)
// This is needed because API_BASE_URL is evaluated at module load time
(window as any).__PLUMBPRO_SERVER_PORT__ = serverPort;

// Define the API that will be exposed to the renderer process
const electronAPI = {
  // Server port (available immediately)
  serverPort,
  // App information
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),
  getPlatform: (): string => process.platform,
  getArch: (): string => process.arch,

  // Server
  getServerPort: (): Promise<number> => ipcRenderer.invoke('get-server-port'),
  restartServer: (): Promise<number> => ipcRenderer.invoke('restart-server'),

  // Auto-update functions
  checkForUpdates: (): Promise<any> => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: (): Promise<void> => ipcRenderer.invoke('download-update'),
  installUpdate: (): Promise<void> => ipcRenderer.invoke('install-update'),
  getUpdateStatus: (): Promise<any> => ipcRenderer.invoke('get-update-status'),

  // Update event listeners
  onUpdateStatus: (callback: (status: any) => void): void => {
    ipcRenderer.on('update-status', (_, status) => callback(status));
  },
  onUpdateAvailable: (callback: (info: any) => void): void => {
    ipcRenderer.on('update-available', (_, info) => callback(info));
  },
  onUpdateDownloaded: (callback: (info: any) => void): void => {
    ipcRenderer.on('update-downloaded', (_, info) => callback(info));
  },
  onDownloadProgress: (callback: (progress: any) => void): void => {
    ipcRenderer.on('download-progress', (_, progress) => callback(progress));
  },
  onUpdateError: (callback: (error: string) => void): void => {
    ipcRenderer.on('update-error', (_, error) => callback(error));
  },

  // Window controls
  minimize: (): void => ipcRenderer.send('window-minimize'),
  maximize: (): void => ipcRenderer.send('window-maximize'),
  close: (): void => ipcRenderer.send('window-close'),

  // Native dialogs
  showSaveDialog: (options: any): Promise<any> => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options: any): Promise<any> => ipcRenderer.invoke('show-open-dialog', options),

  // Utility
  removeAllListeners: (channel: string): void => {
    ipcRenderer.removeAllListeners(channel);
  }
};

// Expose the API to the renderer process via contextBridge
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Log that preload script has loaded
console.log('PlumbPro Desktop: Preload script loaded');
