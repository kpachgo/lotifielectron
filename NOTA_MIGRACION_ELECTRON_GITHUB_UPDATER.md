# Nota de Proceso: Migracion Web -> Electron + GitHub Releases + Auto-Update

## Objetivo
Estandarizar un proceso para migrar apps web (frontend + backend local) a app de escritorio con Electron, publicar en GitHub y gestionar actualizaciones por Releases.

## Resultado logrado en este proyecto
- App migrada a Electron sin cambiar la logica de negocio del backend.
- Instalador Windows generado (`.exe` NSIS).
- Auto-update configurado con GitHub Releases (sin Microsoft Store).
- Repo separado de proyecto anterior para evitar pushes accidentales.

## 1) Estructura recomendada
- `frontend/` (HTML/CSS/JS)
- `backend/` (Express/API/DB)
- `electron/` (main process, splash, integracion desktop)
- `package.json` en raiz para Electron + builder

## 2) Electron wrapper (sin tocar logica de negocio)
- `electron/main.js`:
  - inicia backend local
  - espera disponibilidad de `http://localhost:3000`
  - abre `BrowserWindow`
  - maneja cierre limpio
  - agrega menu nativo
  - agrega splash screen
  - integra `electron-updater`

## 3) Configuracion de build
- `electron-builder` configurado en `package.json`:
  - target Windows NSIS
  - icono `.ico` (app + installer + shortcuts)
  - `publish` apuntando a GitHub (`owner/repo`)
  - versionado semantico (`version`)

## 4) Uploads/comprobantes en entorno Electron
Problema detectado:
- rutas relativas de uploads fallan al empaquetar.

Solucion aplicada:
- carpeta persistente por usuario: `app.getPath('userData')/uploads`
- variable `UPLOADS_DIR` para ruta de guardado
- backend sirve `/uploads` desde esa carpeta + rutas legacy
- rutas guardadas en DB normalizadas como `uploads/<archivo>`

## 5) Archivos y metadatos clave
- Icono: `Lotificacion.ico`
- Splash: `electron/splash.html`
- Main process: `electron/main.js`
- Config build: `package.json`
- Uploads config: `backend/config/uploads.js`

## 6) Publicacion en GitHub (repo nuevo)
Buenas practicas aplicadas:
- remoto viejo renombrado y push bloqueado (`lotifi-legacy`)
- remoto nuevo como `origin` (repo nuevo)
- evitar publicar binarios pesados en git

## 7) Error comun: push rechazado por archivos grandes
Sintoma:
- GitHub rechaza `win-unpacked/*.exe` (>100MB)

Causa:
- carpetas `release*` o binarios incluidos en commit

Prevencion:
- `.gitignore` debe incluir:
  - `node_modules/`
  - `backend/node_modules/`
  - `release/`
  - `release*/`

Publicar binarios en **Releases**, no en commits.

## 8) Auto-update: como funciona (sin tienda)
Si se usa `electron-updater` + GitHub Releases:
1. App consulta updates al iniciar.
2. Si hay version nueva, notifica.
3. Descarga update.
4. Pide reiniciar para instalar.

### Assets obligatorios por release
- `LotifiElectron-Setup-x.y.z.exe`
- `latest.yml`
- `LotifiElectron-Setup-x.y.z.exe.blockmap`

No marcar como pre-release para uso productivo.

## 9) Flujo de versiones recomendado
1. Cambiar `version` en `package.json` (ej. `1.0.2`)
2. Build: `npm run dist:win`
3. Crear Release tag `v1.0.2`
4. Subir assets (`.exe`, `latest.yml`, `.blockmap`)
5. Publicar release
6. Probar update desde version anterior instalada

## 10) Instalacion para usuarios finales
Usuario final solo necesita:
- descargar y ejecutar `LotifiElectron-Setup-x.y.z.exe`

`latest.yml` y `.blockmap` son para el updater.

## 11) Notas de seguridad
- Se versiono `.env` por decision operativa (repo privado).
- Recomendacion general: no versionar secretos en produccion publica.

## 12) Checklist reutilizable para futuros proyectos
- [ ] Crear wrapper Electron (main + splash)
- [ ] Configurar icono y metadatos
- [ ] Configurar build NSIS
- [ ] Normalizar rutas persistentes de archivos de usuario
- [ ] Ignorar `release*` y `node_modules`
- [ ] Separar remoto nuevo de proyecto legado
- [ ] Publicar release con assets de updater
- [ ] Validar instalacion limpia + auto-update
