const electron = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { autoUpdater } = require('electron-updater');

const { app, BrowserWindow, Menu, dialog } = electron;

const PORT = Number(process.env.PORT) || 3000;
const APP_URL = `http://localhost:${PORT}`;
const WAIT_TIMEOUT_MS = 30000;
const RETRY_INTERVAL_MS = 500;
const iconPath = path.join(__dirname, '..', 'Lotificacion.ico');

let backendServer = null;
let splashWindow = null;
let mainWindow = null;
let quitting = false;

if (!app || !BrowserWindow || !dialog) {
  throw new Error(
    'Electron main process no disponible. Ejecuta la app con "npm run electron".'
  );
}

function createMenu() {
  const template = [
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Inicio',
          accelerator: 'Ctrl+H',
          click: () => mainWindow && mainWindow.loadURL(APP_URL)
        },
        {
          label: 'Recargar',
          accelerator: 'Ctrl+R',
          click: () => mainWindow && mainWindow.reload()
        },
        { type: 'separator' },
        { role: 'quit', label: 'Salir' }
      ]
    },
    {
      label: 'Ver',
      submenu: [{ role: 'togglefullscreen', label: 'Pantalla completa' }]
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Buscar actualizaciones',
          click: () => checkForUpdates(true)
        },
        {
          label: 'Acerca de',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'Acerca de LotifiElectron',
              message: `LotifiElectron ${app.getVersion()}`,
              detail: 'Empresa: Lotifi\nAutor: German Manuel Ortiz\nCorreo: gkpach.go@gmail.com'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 520,
    height: 320,
    frame: false,
    resizable: false,
    movable: true,
    center: true,
    show: true,
    alwaysOnTop: true,
    icon: iconPath,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    icon: iconPath,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const child = new BrowserWindow({
      width: 1100,
      height: 800,
      icon: iconPath,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    child.loadURL(url);
    return { action: 'deny' };
  });

  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.loadURL(APP_URL);
}

function startBackend() {
  return new Promise((resolve, reject) => {
    const backendApp = require(path.join(__dirname, '..', 'backend', 'app'));
    backendServer = backendApp.listen(PORT, '127.0.0.1', resolve);

    backendServer.on('error', (error) => {
      if (error && error.code === 'EADDRINUSE') {
        resolve();
        return;
      }
      reject(error);
    });
  });
}

function pingServer() {
  return new Promise((resolve) => {
    const req = http.get(APP_URL, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });

    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForBackend() {
  const start = Date.now();
  while (Date.now() - start < WAIT_TIMEOUT_MS) {
    const ready = await pingServer();
    if (ready) return;
    await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS));
  }

  throw new Error(`Tiempo de espera agotado para iniciar backend en ${APP_URL}`);
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', async (info) => {
    const res = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Descargar', 'Despues'],
      defaultId: 0,
      cancelId: 1,
      title: 'Actualizacion disponible',
      message: `Hay una nueva version (${info.version}).`,
      detail: 'Deseas descargarla ahora?'
    });
    if (res.response === 0) autoUpdater.downloadUpdate();
  });

  autoUpdater.on('update-downloaded', async () => {
    const res = await dialog.showMessageBox({
      type: 'question',
      buttons: ['Instalar y reiniciar', 'Luego'],
      defaultId: 0,
      cancelId: 1,
      title: 'Actualizacion lista',
      message: 'La actualizacion se descargo correctamente.'
    });

    if (res.response === 0) {
      quitting = true;
      autoUpdater.quitAndInstall();
    }
  });
}

async function checkForUpdates(manual = false) {
  if (!app.isPackaged) return;
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    if (manual) {
      dialog.showMessageBox({
        type: 'warning',
        title: 'Actualizaciones',
        message: 'No se pudo verificar actualizaciones.',
        detail: String(error.message || error)
      });
    }
  }
}

async function bootstrap() {
  const persistentUploadsDir = path.join(app.getPath('userData'), 'uploads');
  fs.mkdirSync(persistentUploadsDir, { recursive: true });
  process.env.UPLOADS_DIR = persistentUploadsDir;

  createMenu();
  createSplashWindow();

  await startBackend();
  await waitForBackend();
  createMainWindow();

  setupAutoUpdater();
  checkForUpdates(false);
}

app.whenReady().then(async () => {
  try {
    await bootstrap();
  } catch (error) {
    dialog.showErrorBox(
      'Error de inicio',
      `No se pudo abrir LotifiElectron.\n\n${error.message}`
    );
    app.quit();
  }
});

app.on('before-quit', () => {
  quitting = true;
  if (!backendServer) return;
  backendServer.close();
});

app.on('window-all-closed', () => {
  if (!quitting) app.quit();
});
