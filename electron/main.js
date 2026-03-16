const electron = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { autoUpdater } = require('electron-updater');

const { app, BrowserWindow, Menu, dialog, ipcMain } = electron;

const PORT = Number(process.env.PORT) || 3000;
const APP_URL = `http://localhost:${PORT}`;
const WAIT_TIMEOUT_MS = 30000;
const RETRY_INTERVAL_MS = 500;
const iconPath = path.join(__dirname, '..', 'Lotificacion.ico');
const CONFIG_FILE_NAME = 'app-config.json';
const IPC_UPLOADS_GET = 'uploads-config:get';
const IPC_UPLOADS_VALIDATE = 'uploads-config:validate';
const IPC_UPLOADS_SAVE = 'uploads-config:save';
// CAMBIAR AQUI:
// Ruta de red compartida por defecto para pruebas.
// Puedes reemplazar este valor por otra ruta UNC (\\SERVIDOR\carpeta).
const DEFAULT_SHARED_UPLOADS_DIR = '\\\\Desktop-ssf4s0r\\laptopg\\LOTIFI_SHARED_UPLOADS_DIR';

let backendServer = null;
let splashWindow = null;
let mainWindow = null;
let configWindow = null;
let quitting = false;
let uploadsConfigActivo = null;

if (!app || !BrowserWindow || !dialog) {
  throw new Error(
    'Electron main process no disponible. Ejecuta la app con "npm run electron".'
  );
}

function limpiarRutaConfigurada(valor) {
  if (!valor) return '';
  return String(valor).trim().replace(/^"(.*)"$/, '$1');
}

function rutaArchivoConfig() {
  return path.join(app.getPath('userData'), CONFIG_FILE_NAME);
}

function leerConfigApp() {
  const configPath = rutaArchivoConfig();

  if (!fs.existsSync(configPath)) {
    return {};
  }

  try {
    const contenido = fs.readFileSync(configPath, 'utf8');
    const data = JSON.parse(contenido);
    return data && typeof data === 'object' ? data : {};
  } catch (error) {
    console.warn(`No se pudo leer config ${configPath}: ${error.message}`);
    return {};
  }
}

function guardarConfigApp(config) {
  const configPath = rutaArchivoConfig();
  const data = config && typeof config === 'object' ? config : {};
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf8');
}

function obtenerRutaCompartidaGuardada() {
  const config = leerConfigApp();
  return limpiarRutaConfigurada(config.sharedUploadsDir);
}

function guardarRutaCompartida(rutaCompartida) {
  const config = leerConfigApp();
  config.sharedUploadsDir = limpiarRutaConfigurada(rutaCompartida);
  guardarConfigApp(config);
}

function validarRutaCompartida(rutaRaw) {
  const ruta = limpiarRutaConfigurada(rutaRaw);
  if (!ruta) {
    return { ok: false, normalizedPath: '', message: 'Ingresa una ruta valida.' };
  }

  try {
    fs.mkdirSync(ruta, { recursive: true });

    const tmpName = `.lotifi-write-test-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}.tmp`;
    const tmpPath = path.join(ruta, tmpName);
    fs.writeFileSync(tmpPath, 'ok', 'utf8');
    fs.unlinkSync(tmpPath);

    return { ok: true, normalizedPath: ruta };
  } catch (error) {
    return {
      ok: false,
      normalizedPath: ruta,
      message: error.message || 'No se pudo validar la ruta.'
    };
  }
}

function resolverUploadsDir() {
  const localDir = path.join(app.getPath('userData'), 'uploads');
  const sharedDirGuardado = obtenerRutaCompartidaGuardada();
  const sharedDirConfigurado = limpiarRutaConfigurada(
    sharedDirGuardado
      || process.env.LOTIFI_SHARED_UPLOADS_DIR
      || process.env.SHARED_UPLOADS_DIR
      || process.env.UPLOADS_DIR
      || DEFAULT_SHARED_UPLOADS_DIR
  );

  let sharedError = null;

  if (sharedDirConfigurado) {
    try {
      fs.mkdirSync(sharedDirConfigurado, { recursive: true });
      return {
        uploadDir: sharedDirConfigurado,
        mode: 'shared',
        source: sharedDirGuardado ? 'config' : 'env-default',
        configuredSharedDir: sharedDirConfigurado,
        sharedError: null
      };
    } catch (error) {
      sharedError = error;
    }
  }

  fs.mkdirSync(localDir, { recursive: true });
  return {
    uploadDir: localDir,
    mode: 'local',
    source: 'local-fallback',
    configuredSharedDir: sharedDirConfigurado || null,
    sharedError
  };
}

async function abrirVentanaConfigUploads() {
  if (configWindow && !configWindow.isDestroyed()) {
    configWindow.focus();
    return;
  }

  configWindow = new BrowserWindow({
    width: 640,
    height: 320,
    resizable: false,
    minimizable: false,
    maximizable: false,
    parent: mainWindow || undefined,
    modal: Boolean(mainWindow),
    autoHideMenuBar: true,
    icon: iconPath,
    title: 'Configurar ruta de guardado',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'config-uploads.preload.js')
    }
  });

  configWindow.on('closed', () => {
    configWindow = null;
  });

  await configWindow.loadFile(path.join(__dirname, 'config-uploads.html'));
}

function registrarIpcConfigUploads() {
  ipcMain.removeHandler(IPC_UPLOADS_GET);
  ipcMain.removeHandler(IPC_UPLOADS_VALIDATE);
  ipcMain.removeHandler(IPC_UPLOADS_SAVE);

  ipcMain.handle(IPC_UPLOADS_GET, async () => {
    const guardada = obtenerRutaCompartidaGuardada();
    return {
      savedSharedUploadsDir: guardada || '',
      effectiveUploadsDir: uploadsConfigActivo?.uploadDir || '',
      effectiveMode: uploadsConfigActivo?.mode || '',
      defaultSharedUploadsDir: DEFAULT_SHARED_UPLOADS_DIR
    };
  });

  ipcMain.handle(IPC_UPLOADS_VALIDATE, async (_event, rutaRaw) => {
    return validarRutaCompartida(rutaRaw);
  });

  ipcMain.handle(IPC_UPLOADS_SAVE, async (_event, rutaRaw) => {
    const validacion = validarRutaCompartida(rutaRaw);
    if (!validacion.ok) return validacion;

    guardarRutaCompartida(validacion.normalizedPath);

    const result = await dialog.showMessageBox(configWindow || mainWindow, {
      type: 'question',
      title: 'Ruta guardada',
      message: 'La ruta se guardo correctamente.',
      detail: 'Debes reiniciar la aplicacion para usar la nueva ruta. Reiniciar ahora?',
      buttons: ['Reiniciar ahora', 'Luego'],
      defaultId: 0,
      cancelId: 1
    });

    if (result.response === 0) {
      app.relaunch();
      app.quit();
      return {
        ok: true,
        normalizedPath: validacion.normalizedPath,
        restartScheduled: true
      };
    }

    return {
      ok: true,
      normalizedPath: validacion.normalizedPath,
      restartScheduled: false
    };
  });
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
        {
          label: 'Configurar ruta de guardado...',
          click: () => {
            abrirVentanaConfigUploads();
          }
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
  const uploadsConfig = resolverUploadsDir();
  uploadsConfigActivo = uploadsConfig;
  process.env.UPLOADS_DIR = uploadsConfig.uploadDir;

  if (uploadsConfig.mode === 'shared') {
    console.log(`Uploads compartidos activos: ${uploadsConfig.uploadDir}`);
  } else if (uploadsConfig.configuredSharedDir && uploadsConfig.sharedError) {
    const detail = [
      `No se pudo acceder a la carpeta compartida: ${uploadsConfig.configuredSharedDir}`,
      `Error: ${uploadsConfig.sharedError.message}`,
      '',
      `Se usara carpeta local temporal: ${uploadsConfig.uploadDir}`
    ].join('\n');

    console.warn(detail);
    dialog.showMessageBox({
      type: 'warning',
      title: 'Uploads en modo local',
      message: 'No se pudo abrir la carpeta compartida de comprobantes.',
      detail
    });
  }

  createMenu();
  registrarIpcConfigUploads();
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
