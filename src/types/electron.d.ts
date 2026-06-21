interface UpdateCheckResult {
  updateAvailable: boolean;
  latestVersion: string;
  currentVersion: string;
  downloadUrl: string | null;
  releaseUrl: string;
  releaseNotes: string | null;
}

interface DownloadProgress {
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  done: boolean;
  error?: string;
  filePath?: string;
}

interface ElectronAPI {
  platform: string;
  getVersion: () => string;
  checkForUpdates: () => Promise<UpdateCheckResult>;
  downloadUpdate: (assetUrl: string) => Promise<void>;
  getLastUpdateCheck: () => Promise<number | null>;
  setLastUpdateCheck: (ts: number) => Promise<void>;
  onUpdateDownloadProgress: (callback: (data: DownloadProgress) => void) => () => void;
}

interface Window {
  electron: ElectronAPI;
}
