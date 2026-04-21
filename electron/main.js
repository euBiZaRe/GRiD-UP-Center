import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn, execSync } from 'child_process';
import isDev from 'electron-is-dev';
import fs from 'fs';
import os from 'os';

function getMachineId() {
  try {
    if (process.platform === 'win32') {
      const stdout = execSync('reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid').toString();
      // Parse output format: MachineGuid    REG_SZ    xxxx-xxxx-xxxx
      const match = stdout.match(/MachineGuid\s+REG_SZ\s+(.+)/);
      return match ? match[1].trim() : 'unknown-window';
    } else {
      // Fallback for non-windows (though we target windows)
      return os.hostname() || 'unknown-unique';
    }
  } catch (e) {
    console.error('Failed to get machine identification:', e);
    return 'fallback-id-' + os.hostname();
  }
}


const currentFile = fileURLToPath(import.meta.url);
const currentDir = dirname(currentFile);

let tracksData = null;
const tracksPath = join(currentDir, '../assets/tracks.json');

function loadTracks() {
  try {
    // In production, assets are in the resources folder
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

  const url = isDev 
    ? 'http://localhost:3000' 
    : `file://${join(currentDir, '../dist/index.html')}`;

  mainWindow.loadURL(url);

  mainWindow.once('ready-to-show', () => {
    // Artificial minimum delay for splash screen aesthetics
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
  let bridgeProcess;
  
  if (isDev) {
    const bridgePath = join(currentDir, '../bridge/bridge.py');
    console.log("Starting Python Bridge (Dev):", bridgePath);
    bridgeProcess = spawn('python', [bridgePath]);
  } else {
    const bridgePath = join(process.resourcesPath, 'bridge/bridge.exe');
    console.log("Starting Compiled Bridge (Prod):", bridgePath);
    bridgeProcess = spawn(bridgePath);
  }

  bridgeProcess.stdout.on('data', (data) => {
    console.log(`Bridge: ${data}`);
    if (mainWindow) mainWindow.webContents.send('bridge-status', data.toString());
  });

  bridgeProcess.stderr.on('data', (data) => {
    console.error(`Bridge Error: ${data}`);
  });

  bridgeProcess.on('close', (code) => {
    console.log(`Bridge process exited with code ${code}`);
  });

  return bridgeProcess;
}

app.whenReady().then(() => {
  loadTracks();
  createSplashWindow();

  ipcMain.handle('get-track-data', async (event, trackId) => {
    if (!tracksData) return null;
    return tracksData[trackId] || null;
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
  ipcMain.handle('get-machine-id', async () => {
    return getMachineId();
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
