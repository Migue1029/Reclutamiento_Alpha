// desktop-app/main.js
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { SERVER_URL } = require('./config'); // usa config.js

let mainWindow;

// Evitar múltiples instancias
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1366,
      height: 768,
      minWidth: 1024,
      minHeight: 600,
      backgroundColor: '#ffffff',
      show: false,
      title: 'ReclutamientoAlpha',
      icon: path.join(__dirname, 'icon.ico'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    mainWindow.removeMenu();
    mainWindow.loadURL(SERVER_URL);

    mainWindow.once('ready-to-show', () => {
      mainWindow.maximize();
      mainWindow.show();
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }

  app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
