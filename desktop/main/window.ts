import { BrowserWindow, shell, app } from 'electron';
import path from 'path';
import log from 'electron-log';

let mainWindow: BrowserWindow | null = null;

export async function createWindow(serverPort: number): Promise<BrowserWindow> {
  log.info('Creating main window...');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    },
    icon: getIconPath(),
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#ffffff',
    autoHideMenuBar: process.platform !== 'darwin'
  });

  // Show loading screen first
  const loadingPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar', 'dist', 'main', '..', 'resources', 'splash', 'loading.html')
    : path.join(__dirname, '../resources/splash/loading.html');

  try {
    await mainWindow.loadFile(loadingPath);
  } catch (error) {
    log.warn('Could not load splash screen, continuing...');
  }

  mainWindow.show();

  // Load the main application
  if (app.isPackaged) {
    // Production: Load from bundled frontend
    const frontendPath = path.join(process.resourcesPath, 'frontend', 'index.html');
    log.info(`Loading frontend from: ${frontendPath}`);

    // Inject server port into the page
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow?.webContents.executeJavaScript(`
        window.__PLUMBPRO_SERVER_PORT__ = ${serverPort};
      `);
    });

    await mainWindow.loadFile(frontendPath);
  } else {
    // Development: Load from Vite dev server
    const devUrl = `http://localhost:5173`;
    log.info(`Loading dev server from: ${devUrl}`);

    // Inject server port
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow?.webContents.executeJavaScript(`
        window.__PLUMBPRO_SERVER_PORT__ = ${serverPort};
      `);
    });

    await mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools();
  }

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Window events
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('unresponsive', () => {
    log.warn('Window became unresponsive');
  });

  mainWindow.on('responsive', () => {
    log.info('Window is responsive again');
  });

  mainWindow.webContents.on('crashed', () => {
    log.error('Renderer process crashed');
  });

  mainWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
    log.error(`Failed to load: ${errorCode} - ${errorDescription}`);
  });

  return mainWindow;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

function getIconPath(): string {
  const iconName = process.platform === 'win32'
    ? 'icon.ico'
    : process.platform === 'darwin'
      ? 'icon.icns'
      : 'icon.png';

  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app.asar', 'dist', 'main', '..', 'resources', 'icons', iconName);
  }

  return path.join(__dirname, '../resources/icons', iconName);
}
