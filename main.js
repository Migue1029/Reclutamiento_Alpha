// main.js
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { SERVER_URL } = require('./config');

// Evitar múltiples instancias
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  let mainWindow = null;

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1366,
      height: 768,
      minWidth: 1024,
      minHeight: 600,
      backgroundColor: '#eef1f6ff', // se ve bien mientras carga
      title: 'ReclutamientoAlpha',
      icon: path.join(__dirname, 'icon.ico'), // opcional, si agregas un icon.ico
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    // Quitar menú clásico de escritorio (Archivo, Editar, etc.)
    mainWindow.removeMenu();

    // Cargar la URL del servidor (backend + frontend)
    mainWindow.loadURL(SERVER_URL);

    // Opcional: maximizar al abrir
    mainWindow.maximize();

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('second-instance', () => {
    // Si alguien intenta abrir otra instancia, enfocamos la ventana existente
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.on('window-all-closed', () => {
    // En Windows normalmente cerramos la app cuando se cierra la ventana
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
