const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pet', {
  loadAssets: () => ipcRenderer.invoke('load-assets'),
  getBounds: () => ipcRenderer.invoke('get-bounds'),
  getFollowInfo: () => ipcRenderer.invoke('get-follow-info'),
  setPos: (x, y) => ipcRenderer.send('set-pos', x, y),
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),
  showMenu: (actions, settings) => ipcRenderer.send('show-menu', actions, settings),
  onRunAction: (fn) => ipcRenderer.on('run-action', (_e, name) => fn(name)),
  onSetting: (fn) => ipcRenderer.on('set-setting', (_e, key, on) => fn(key, on)),
  onPause: (fn) => ipcRenderer.on('pause', (_e, paused) => fn(paused)),
  heartbeat: () => ipcRenderer.send('heartbeat'),
  onCursor: (fn) => ipcRenderer.on('cursor', (_e, x, y) => fn(x, y)),
});
