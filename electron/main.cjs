const { app, BrowserWindow, globalShortcut, Menu, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const https = require('https');

function waitForBackend(url, retries = 40, delay = 500) {  // 20 seconds total
  return new Promise((resolve, reject) => {
    const attempt = () => {
      http.get(url, () => {
        resolve();
      }).on('error', () => {
        if (retries-- > 0) {
          setTimeout(attempt, delay);
        } else {
          reject(new Error('Backend did not start in time'));
        }
      });
    };
    attempt();
  });
}

process.env.USER_DATA_PATH = app.getPath('userData');

console.log('USER_DATA_PATH:', process.env.USER_DATA_PATH);

let mainWindow = null;
let serverProcess = null;

function startBackend() {
  const isDev = !app.isPackaged;

  console.log(
    `Starting backend in ${isDev ? 'development' : 'production'} mode`
  );

  // =====================================================
  // DEVELOPMENT MODE
  // =====================================================
  // DO NOT start backend here.
  // npm run backend already starts it.
  // Starting another backend causes DB conflicts.
  // =====================================================

  if (isDev) {
    console.log('Development mode: using existing backend');
    return;
  }

  // =====================================================
  // PRODUCTION MODE
  // =====================================================

  let backendPath;

  const possiblePaths = [
    path.join(process.resourcesPath, 'server/index.cjs'),
    path.join(process.resourcesPath, 'app.asar/server/index.cjs'),
    path.join(__dirname, './server/dist/index.cjs')
  ];

  console.log('Trying backend paths:', possiblePaths);

  for (const testPath of possiblePaths) {
    if (fs.existsSync(testPath)) {
      backendPath = testPath;
      console.log('Found backend:', backendPath);
      break;
    }
  }

  if (!backendPath) {
    console.error('Backend not found');
    return;
  }

  const electronNodePath = process.execPath;

  serverProcess = spawn(
    electronNodePath,
    [backendPath],
    {
      stdio: 'pipe',
      windowsHide: true,
      env: {
        ...process.env,

        ELECTRON_RUN_AS_NODE: '1',

        NODE_ENV: 'production',
        PORT: '3000',

        APP_TYPE: 'pharmacy',
        APP_DB_NAME: 'pos_pharmacy.db',

        USER_DATA_PATH: app.getPath('userData')
      }
    }
  );

  serverProcess.stdout.on('data', (data) => {
    console.log(`[Backend]: ${data.toString()}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`[Backend Error]: ${data.toString()}`);
  });

  serverProcess.on('close', (code) => {
    console.log(`Backend exited with code ${code}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    show: false,
    title: 'POS Pharmacy',
    icon: path.join(__dirname, '../assets/icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  mainWindow.setMenu(null);
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  const isDev = !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Show loading screen first
    mainWindow.loadURL(`data:text/html,
      <html>
        <body style="margin:0;background:#141414;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
          <div style="text-align:center">
            <div style="width:48px;height:48px;border:4px solid #333;border-top:4px solid #22c55e;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 20px;"></div>
            <p style="color:#fff;font-size:18px;font-weight:600;margin:0 0 8px">Starting POS...</p>
            <p style="color:#666;font-size:13px;margin:0">Please wait while the app loads</p>
          </div>
          <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
        </body>
      </html>
    `);

    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    });

    // Load actual app once backend is ready
    waitForBackend('http://127.0.0.1:3000/api/health', 40, 500)
      .then(() => {
        const indexPath = path.join(__dirname, '../dist/index.html');
        if (fs.existsSync(indexPath)) {
          mainWindow.loadFile(indexPath, { hash: '/' });
        } else {
          console.error('Frontend build not found');
          app.quit();
        }
      })
      .catch((err) => {
        console.error(err.message);
        // Try loading anyway as last resort
        const indexPath = path.join(__dirname, '../dist/index.html');
        if (fs.existsSync(indexPath)) {
          mainWindow.loadFile(indexPath, { hash: '/' });
        }
      });
  }

  // Disable inspect/devtools in production
  if (app.isPackaged) {
    globalShortcut.register('CommandOrControl+Shift+I', () => { });
    globalShortcut.register('F12', () => { });
    globalShortcut.register('CommandOrControl+Shift+J', () => { });
    globalShortcut.register('CommandOrControl+Shift+C', () => { });
  }

  globalShortcut.register('CommandOrControl+R', () => {
    if (mainWindow) mainWindow.webContents.reload();
  });

  mainWindow.webContents.on('context-menu', (e) => e.preventDefault());
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── Update Checker ─────────────────────────────────────────────────────────
const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const GITHUB_OWNER = 'Light0777';
const GITHUB_REPO = 'pos-pharmacyofflineNew';

function semverCompare(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

function getLastUpdateCheckPath() {
  return path.join(app.getPath('userData'), 'last-update-check.json');
}

function readLastUpdateCheck() {
  try {
    const raw = fs.readFileSync(getLastUpdateCheckPath(), 'utf8');
    return JSON.parse(raw).timestamp || null;
  } catch { return null; }
}

function writeLastUpdateCheck(timestamp) {
  fs.writeFileSync(getLastUpdateCheckPath(), JSON.stringify({ timestamp }), 'utf8');
}

async function checkForUpdates() {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'pos-pharmacy', 'Accept': 'application/vnd.github.v3+json' },
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            resolve({ error: `GitHub API returned ${res.statusCode}` });
            return;
          }
          const release = JSON.parse(data);
          const tag = release.tag_name || '';
          const latestVersion = tag.replace(/^v/, '');
          const currentVersion = app.getVersion();
          const updateAvailable = semverCompare(latestVersion, currentVersion) > 0;
          resolve({
            updateAvailable,
            latestVersion,
            currentVersion,
            downloadUrl: release.assets?.[0]?.browser_download_url || null,
            releaseUrl: release.html_url,
            releaseNotes: release.body || null,
          });
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}

// ─── IPC Handlers ───────────────────────────────────────────────────────────
ipcMain.handle('check-for-updates', async () => {
  const lastCheck = readLastUpdateCheck();
  const now = Date.now();
  if (lastCheck && (now - lastCheck) < UPDATE_CHECK_INTERVAL) {
    return { skipped: true, nextCheckAt: lastCheck + UPDATE_CHECK_INTERVAL };
  }
  try {
    const result = await checkForUpdates();
    writeLastUpdateCheck(now);
    return result;
  } catch (err) {
    return { error: err.message || 'Update check failed' };
  }
});

ipcMain.handle('get-last-update-check', () => readLastUpdateCheck());

ipcMain.handle('set-last-update-check', (_event, timestamp) => {
  writeLastUpdateCheck(timestamp);
});

ipcMain.handle('download-update', async (event, assetUrl) => {
  const ext = assetUrl.endsWith('.exe') ? '.exe' : path.extname(new URL(assetUrl).pathname) || '.exe';
  const dest = path.join(app.getPath('temp'), `pos-pharmacy-update${ext}`);
  return new Promise((resolve, reject) => {
    https.get(assetUrl, { headers: { 'User-Agent': 'pos-pharmacy' }, timeout: 300000 }, (res) => {
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let downloaded = 0;
      const fileStream = fs.createWriteStream(dest);
      res.on('data', (chunk) => {
        downloaded += chunk.length;
        const pct = total ? Math.round((downloaded / total) * 100) : 0;
        event.sender.send('update-download-progress', {
          progress: pct, downloadedBytes: downloaded, totalBytes: total, done: false,
        });
      });
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        event.sender.send('update-download-progress', {
          progress: 100, downloadedBytes: total, totalBytes: total, done: true, filePath: dest,
        });
        shell.openPath(dest);
        resolve();
      });
    }).on('error', (err) => {
      event.sender.send('update-download-progress', {
        progress: 0, done: true, error: err.message,
      });
      reject(err);
    });
  });
});

app.whenReady().then(() => {
  const { session } = require('electron');

  const isDev = !app.isPackaged;

  const csp = isDev
    ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; connect-src 'self' http://127.0.0.1:3000 http://localhost:5173 ws://localhost:5173; font-src 'self' data: https://fonts.gstatic.com"
    : "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; connect-src 'self' http://127.0.0.1:3000; font-src 'self' data: https://fonts.gstatic.com";

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp]
      }
    });
  });

  startBackend();
  const emptyMenu = Menu.buildFromTemplate([]);
  Menu.setApplicationMenu(emptyMenu);
  createWindow();
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

process.on('SIGINT', () => {
  if (serverProcess) {
    serverProcess.kill();
  }

  app.quit();
});

process.on('SIGTERM', () => {
  if (serverProcess) {
    serverProcess.kill();
  }

  app.quit();
});