import { app, Menu, shell, BrowserWindow, MenuItemConstructorOptions } from 'electron';
import { checkForUpdates } from './updater';
import { getMainWindow } from './window';

export function setupMenu(): void {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' as const },
            { type: 'separator' as const },
            {
              label: 'Check for Updates...',
              click: () => checkForUpdates()
            },
            { type: 'separator' as const },
            { role: 'services' as const },
            { type: 'separator' as const },
            { role: 'hide' as const },
            { role: 'hideOthers' as const },
            { role: 'unhide' as const },
            { type: 'separator' as const },
            { role: 'quit' as const }
          ]
        }]
      : []),

    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'Refresh',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            const win = getMainWindow();
            win?.webContents.reload();
          }
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },

    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac
          ? [
              { role: 'pasteAndMatchStyle' as const },
              { role: 'delete' as const },
              { role: 'selectAll' as const }
            ]
          : [
              { role: 'delete' as const },
              { type: 'separator' as const },
              { role: 'selectAll' as const }
            ])
      ]
    },

    // View menu
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            const win = getMainWindow();
            win?.webContents.reloadIgnoringCache();
          }
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: isMac ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
          click: () => {
            const win = getMainWindow();
            win?.webContents.toggleDevTools();
          }
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },

    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
              { type: 'separator' as const },
              { role: 'window' as const }
            ]
          : [{ role: 'close' as const }])
      ]
    },

    // Help menu
    {
      role: 'help',
      submenu: [
        {
          label: 'PlumbPro Documentation',
          click: async () => {
            await shell.openExternal('https://docs.plumbpro.com');
          }
        },
        {
          label: 'Report an Issue',
          click: async () => {
            await shell.openExternal('https://github.com/VoidbreakDev/PlumbPro-Inventory/issues');
          }
        },
        { type: 'separator' },
        ...(!isMac
          ? [
              {
                label: 'Check for Updates...',
                click: () => checkForUpdates()
              },
              { type: 'separator' as const }
            ]
          : []),
        {
          label: 'About PlumbPro Inventory',
          click: () => {
            const win = getMainWindow();
            if (win) {
              const { dialog } = require('electron');
              dialog.showMessageBox(win, {
                type: 'info',
                title: 'About PlumbPro Inventory',
                message: 'PlumbPro Inventory',
                detail: `Version: ${app.getVersion()}\nElectron: ${process.versions.electron}\nChrome: ${process.versions.chrome}\nNode.js: ${process.versions.node}\n\nA comprehensive inventory management solution for plumbing professionals.`
              });
            }
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
