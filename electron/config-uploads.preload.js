const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('uploadsConfig', {
  get: () => ipcRenderer.invoke('uploads-config:get'),
  validate: (ruta) => ipcRenderer.invoke('uploads-config:validate', ruta),
  save: (ruta) => ipcRenderer.invoke('uploads-config:save', ruta)
});
