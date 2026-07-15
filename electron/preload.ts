import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  getVersion: () => process.env.npm_package_version || '1.0.0',
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: (assetUrl: string) => ipcRenderer.invoke('download-update', assetUrl),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  openWhatsApp: (url: string) => ipcRenderer.invoke('open-whatsapp', url),
  getLastUpdateCheck: () => ipcRenderer.invoke('get-last-update-check'),
  setLastUpdateCheck: (ts: number) => ipcRenderer.invoke('set-last-update-check', ts),
  onUpdateDownloadProgress: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('update-download-progress', handler);
    return () => ipcRenderer.removeListener('update-download-progress', handler);
  },
});
