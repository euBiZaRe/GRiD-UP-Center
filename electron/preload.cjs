const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  send: (channel, data) => ipcRenderer.send(channel, data),
  on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args)),
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  getTrackData: (trackId) => ipcRenderer.invoke('get-track-data', trackId),
  getMachineId: () => ipcRenderer.invoke('get-machine-id'),
  sendCommand: (cmd) => ipcRenderer.send('bridge-command', cmd),
});
