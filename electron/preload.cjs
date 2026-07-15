// electron/preload.ts
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("electron", {
  platform: process.platform,
  getVersion: () => process.env.npm_package_version || "1.0.0",
  checkForUpdates: () => import_electron.ipcRenderer.invoke("check-for-updates"),
  downloadUpdate: (assetUrl) => import_electron.ipcRenderer.invoke("download-update", assetUrl),
  openExternal: (url) => import_electron.ipcRenderer.invoke("open-external", url),
  getLastUpdateCheck: () => import_electron.ipcRenderer.invoke("get-last-update-check"),
  setLastUpdateCheck: (ts) => import_electron.ipcRenderer.invoke("set-last-update-check", ts),
  onUpdateDownloadProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    import_electron.ipcRenderer.on("update-download-progress", handler);
    return () => import_electron.ipcRenderer.removeListener("update-download-progress", handler);
  }
});
