import { useState, useEffect, useCallback } from "react";

const TEST_MODE_KEY = 'UPDATE_TEST_MODE';
const TEST_CURRENT_KEY = 'UPDATE_TEST_CURRENT_VERSION';
const TEST_LATEST_KEY = 'UPDATE_TEST_LATEST_VERSION';
const TEST_DOWNLOAD_KEY = 'UPDATE_TEST_DOWNLOAD_URL';
const DISMISSED_KEY = 'update-banner-dismissed';

interface BannerState {
  visible: boolean;
  currentVersion: string;
  latestVersion: string;
  downloadUrl: string | null;
  releaseUrl: string;
  releaseNotes: string | null;
  downloading: boolean;
  downloadProgress: number;
  error: string | null;
}

export default function UpdateBanner() {
  const [state, setState] = useState<BannerState>({
    visible: false,
    currentVersion: '',
    latestVersion: '',
    downloadUrl: null,
    releaseUrl: '',
    releaseNotes: null,
    downloading: false,
    downloadProgress: 0,
    error: null,
  });

  const cleanupRef = useState<(() => void) | null>(null);

  const check = useCallback(async () => {
    if (localStorage.getItem(TEST_MODE_KEY) === 'true') {
      const current = localStorage.getItem(TEST_CURRENT_KEY) || '1.0.0';
      const latest = localStorage.getItem(TEST_LATEST_KEY) || '1.1.0';
      const downloadUrl = localStorage.getItem(TEST_DOWNLOAD_KEY) || 'https://example.com/dummy.exe';
      setState((prev) => ({
        ...prev,
        visible: true,
        currentVersion: current,
        latestVersion: latest,
        downloadUrl,
        releaseUrl: '#',
        releaseNotes: 'Test mode — no actual release.',
        error: null,
      }));
      return;
    }

    if (!window.electron) return;

    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed === 'true') return;

    try {
      const result = await window.electron.checkForUpdates();
      if (result.error || result.skipped) return;
      if (result.updateAvailable) {
        setState((prev) => ({
          ...prev,
          visible: true,
          currentVersion: result.currentVersion,
          latestVersion: result.latestVersion,
          downloadUrl: result.downloadUrl,
          releaseUrl: result.releaseUrl,
          releaseNotes: result.releaseNotes,
          error: null,
        }));
      }
    } catch {
      // no internet — silently ignore
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  useEffect(() => {
    if (!window.electron) return;
    const unsub = window.electron.onUpdateDownloadProgress((data) => {
      if (data.error) {
        setState((prev) => ({ ...prev, downloading: false, error: data.error || 'Download failed' }));
        return;
      }
      setState((prev) => ({
        ...prev,
        downloading: !data.done,
        downloadProgress: data.progress,
      }));
    });
    cleanupRef[1](unsub);
    return unsub;
  }, []);

  const handleUpdateNow = async () => {
    if (!state.downloadUrl) return;
    if (!window.electron) {
      setState((prev) => ({ ...prev, error: 'Download not available in browser mode. Install the desktop app.' }));
      return;
    }
    setState((prev) => ({ ...prev, downloading: true, downloadProgress: 0, error: null }));
    try {
      await window.electron.downloadUpdate(state.downloadUrl);
    } catch {
      setState((prev) => ({ ...prev, downloading: false, error: 'Download failed' }));
    }
  };

  const handleLater = () => {
    setState((prev) => ({ ...prev, visible: false }));
    localStorage.setItem(DISMISSED_KEY, 'true');
  };

  if (!state.visible) return null;

  return (
    <div className="bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-screen-2xl mx-auto px-4 lg:px-6 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
          <p className="text-sm text-slate-700 truncate">
            <span className="font-semibold text-slate-900">New version available</span>
            <span className="mx-1.5 text-slate-300">·</span>
            v{state.latestVersion}
            <span className="mx-1.5 text-slate-300">·</span>
            <span className="text-slate-500">Current: v{state.currentVersion}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {state.downloading ? (
            <div className="flex items-center gap-2">
              <div className="w-28 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all duration-300" style={{ width: `${state.downloadProgress}%` }} />
              </div>
              <span className="text-xs text-slate-500 font-medium w-9 text-right tabular-nums">{state.downloadProgress}%</span>
            </div>
          ) : (
            <>
              <button
                onClick={handleUpdateNow}
                disabled={!state.downloadUrl}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Update Now
              </button>
              <button
                onClick={handleLater}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
              >
                Later
              </button>
            </>
          )}
          {state.error && (
            <span className="text-xs text-red-500 font-medium">{state.error}</span>
          )}
        </div>
      </div>
    </div>
  );
}
