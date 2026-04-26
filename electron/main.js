import { app, BrowserWindow, ipcMain, desktopCapturer, session } from 'electron';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn, execSync } from 'child_process';
import isDev from 'electron-is-dev';
import fs from 'fs';
import os from 'os';

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// Configure AutoUpdater
autoUpdater.autoDownload = true;
autoUpdater.allowPrerelease = false;

function setupAutoUpdater(win) {
  if (isDev) return; 

  autoUpdater.on('checking-for-update', () => {
    win.webContents.send('checking-for-update');
  });

  autoUpdater.on('update-available', (info) => {
    win.webContents.send('update-available', info.version);
  });

  autoUpdater.on('update-not-available', (info) => {
    win.webContents.send('update-not-available', info.version);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    win.webContents.send('update-progress', Math.round(progressObj.percent));
  });

  autoUpdater.on('update-downloaded', (info) => {
    win.webContents.send('update-ready');
  });

  autoUpdater.on('error', (err) => {
    console.error('Update Error:', err);
    win.webContents.send('update-error', err.message);
  });

  autoUpdater.checkForUpdatesAndNotify();
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 60 * 60 * 1000);
}

function getMachineId() {
  try {
    if (process.platform === 'win32') {
      const stdout = execSync('reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid').toString();
      const match = stdout.match(/MachineGuid\s+REG_SZ\s+(.+)/);
      return match ? match[1].trim().toUpperCase() : 'unknown-window';
    } else {
      return (os.hostname() || 'unknown-unique').toUpperCase();
    }
  } catch (e) {
    console.error('Failed to get machine identification:', e);
    return ('fallback-id-' + os.hostname()).toUpperCase();
  }
}

const currentFile = fileURLToPath(import.meta.url);
const currentDir = dirname(currentFile);

let tracksData = null;

function loadTracks() {
  try {
    const tracksPath = isDev 
      ? join(currentDir, '../assets/tracks.json')
      : join(process.resourcesPath, 'assets/tracks.json');
      
    const raw = fs.readFileSync(tracksPath);
    tracksData = JSON.parse(raw);
    console.log(`Loaded ${Object.keys(tracksData).length} tracks from database.`);
  } catch (e) {
    console.error("Failed to load tracks.json", e);
  }
}

let mainWindow;
let splashWindow;
let bridgeProcess;

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 600,
    height: 400,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  splashWindow.loadFile(join(currentDir, '../splash.html'));
  splashWindow.center();
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    backgroundColor: '#0d0d0d',
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(currentDir, 'preload.cjs'),
    },
    icon: join(currentDir, '../assets/icons/app.ico'),
  });

  mainWindow.setMenu(null);
  
  // Activate Auto-Updater
  setupAutoUpdater(mainWindow);

  const url = isDev 
    ? 'http://localhost:3000' 
    : `file://${join(currentDir, '../dist/index.html')}`;

  mainWindow.loadURL(url);

  mainWindow.once('ready-to-show', () => {
    setTimeout(() => {
      if (splashWindow) splashWindow.close();
      mainWindow.show();
      mainWindow.maximize();
    }, 3000);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (bridgeProcess) bridgeProcess.kill();
    app.quit();
  });
}

function startBridge() {
  let proc;
  if (isDev) {
    const bridgePath = join(currentDir, '../bridge/bridge.py');
    console.log("Starting Python Bridge (Dev):", bridgePath);
    proc = spawn('python', [bridgePath]);
  } else {
    const bridgePath = join(process.resourcesPath, 'bridge/bridge.exe');
    console.log("Starting Compiled Bridge (Prod):", bridgePath);
    proc = spawn(bridgePath);
  }

  proc.stdout.on('data', (data) => {
    if (mainWindow) mainWindow.webContents.send('bridge-status', data.toString());
  });

  return proc;
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'display-capture') {
      callback(true);
    } else {
      callback(true); // Allow other generic permissions for now
    }
  });

  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['window', 'screen'] }).then((sources) => {
      // Auto-detect iRacing to save the user from a popup picker
      const iracingWindow = sources.find(s => s.name.toLowerCase().includes('iracing'));
      if (iracingWindow) {
        callback({ video: iracingWindow });
      } else {
        const primaryScreen = sources.find(s => s.id.startsWith('screen'));
        callback({ video: primaryScreen || sources[0] });
      }
    }).catch(err => {
      console.error('desktopCapturer error', err);
      callback(null);
    });
  });

  loadTracks();
  createSplashWindow();

  ipcMain.handle('get-track-data', async (event, trackId) => {
    if (!tracksData) return null;
    return tracksData[trackId] || null;
  });

  ipcMain.handle('save-video', async (event, { arrayBuffer, fileName }) => {
    try {
      const buffer = Buffer.from(arrayBuffer);
      const videoDir = join(os.homedir(), 'Videos', 'GridUp');
      if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });
      
      const filePath = join(videoDir, fileName);
      fs.writeFileSync(filePath, buffer);
      return filePath;
    } catch (e) {
      console.error("Failed to save video:", e);
      return null;
    }
  });

  ipcMain.on('bridge-command', (event, cmd) => {
    if (bridgeProcess && bridgeProcess.stdin) {
      bridgeProcess.stdin.write(JSON.stringify(cmd) + '\n');
    }
  });

  ipcMain.on('window-control', (event, command) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    if (command === 'minimize') win.minimize();
    if (command === 'maximize') {
      if (win.isMaximized()) win.unmaximize();
      else win.maximize();
    }
    if (command === 'close') win.close();
  });
  
  ipcMain.handle('get-machine-id', async () => {
    return getMachineId();
  });

  ipcMain.on('install-update', () => {
    autoUpdater.quitAndInstall();
  });

  ipcMain.on('check-for-updates', () => {
    autoUpdater.checkForUpdatesAndNotify();
  });

  createMainWindow();
  bridgeProcess = startBridge();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (bridgeProcess) bridgeProcess.kill();
    app.quit();
  }
});
