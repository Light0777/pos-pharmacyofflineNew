const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  getVersion: () => process.env.npm_package_version || '1.0.0',
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: (assetUrl) => ipcRenderer.invoke('download-update', assetUrl),
  getLastUpdateCheck: () => ipcRenderer.invoke('get-last-update-check'),
  setLastUpdateCheck: (ts) => ipcRenderer.invoke('set-last-update-check', ts),
  onUpdateDownloadProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('update-download-progress', handler);
    return () => ipcRenderer.removeListener('update-download-progress', handler);
  },
});
