const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, powerMonitor, screen } = require('electron');
const fs = require('fs');
const path = require('path');
const { watchFullscreen } = require('./fullscreen');

const WIN_W = 360;
const WIN_H = 300;

let win;
let tray;

// Settings the main process owns (the renderer keeps its own in localStorage).
const SETTINGS_FILE = () => path.join(app.getPath('userData'), 'settings.json');
let settings = { hideOnFullscreen: true };
function loadSettings() {
  try { settings = { ...settings, ...JSON.parse(fs.readFileSync(SETTINGS_FILE(), 'utf8')) }; } catch { /* first run */ }
}
function saveSettings() {
  try { fs.writeFileSync(SETTINGS_FILE(), JSON.stringify(settings, null, 2)); } catch { /* read-only */ }
}

// While a fullscreen app (a game, a fullscreen video) is in front, Clawd hides and goes quiet.
let hiddenForFullscreen = false;
function setFullscreenHidden(hide) {
  if (!win || win.isDestroyed() || hide === hiddenForFullscreen) return;
  hiddenForFullscreen = hide;
  win.webContents.send('pause', hide);
  if (hide) {
    win.hide();
  } else {
    win.showInactive();
    win.setAlwaysOnTop(true, 'screen-saver');
    repaint();
  }
}

// A transparent window can come back blank after the screen sleeps, locks or changes, even
// though the page is still running. Asking for a fresh frame fixes that.
function repaint() {
  if (!win || win.isDestroyed()) return;
  win.webContents.invalidate();
  const b = win.getBounds();
  win.setBounds({ ...b, width: b.width + 1 });
  win.setBounds(b);
}

// Throw the window away and build a new one: used when Clawd is started again (so the
// shortcut always brings back a visible pet), when the page crashes, and when it stops
// sending heartbeats. The new window exists before the old one closes, so the app never
// sees "all windows closed".
let lastBeat = Date.now();
function rebuildWindow(reason) {
  console.warn('rebuilding pet window:', reason);
  const old = win;
  hiddenForFullscreen = false;
  createWindow();
  if (old && !old.isDestroyed()) old.destroy();
}
ipcMain.on('heartbeat', () => { lastBeat = Date.now(); });
const ICON = path.join(__dirname, 'assets', 'icon.png');

function moveHome() {
  const { workArea } = screen.getPrimaryDisplay();
  win.setBounds({ x: workArea.x + workArea.width - WIN_W - 40, y: workArea.y + workArea.height - WIN_H, width: WIN_W, height: WIN_H });
}

// The pet has no taskbar button, so a tray icon is how you find it, call it back or quit.
function createTray() {
  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }));
  tray.setToolTip('Clawd 桌宠');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '回到右下角', click: () => { moveHome(); setFullscreenHidden(false); win.showInactive(); repaint(); } },
    { label: '重新加载 Clawd', click: () => rebuildWindow('tray') },
    { type: 'separator' },
    { label: '退出 Clawd', click: () => app.quit() },
  ]));
  tray.on('click', () => { moveHome(); setFullscreenHidden(false); win.showInactive(); repaint(); });
}

// A few hundred rects don't need the GPU, and software rendering avoids transparent-window GPU crashes.
app.disableHardwareAcceleration();
// Sounds can also come from menu-triggered actions, which are not page gestures.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  lastBeat = Date.now();
  const w = new BrowserWindow({
    width: WIN_W,
    height: WIN_H,
    x: workArea.x + workArea.width - WIN_W - 40,
    y: workArea.y + workArea.height - WIN_H,
    transparent: true,
    frame: false,
    resizable: false,
    maximizable: false,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    icon: ICON,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Windows can report a transparent always-on-top window as occluded, which pauses
      // timers and animation frames; the pet must keep running regardless.
      backgroundThrottling: false,
    },
  });
  win = w;
  w.setAlwaysOnTop(true, 'screen-saver');
  // CLAWD_ACTION=<name> starts with that action and turns off random actions (handy for testing).
  w.loadFile(path.join(__dirname, 'renderer', 'index.html'), { query: { action: process.env.CLAWD_ACTION || '' } });
  // Transparent pixels pass clicks through; the renderer turns this off while the cursor is over Clawd.
  w.setIgnoreMouseEvents(true, { forward: true });
  w.webContents.on('render-process-gone', (_e, details) => {
    if (w === win) setTimeout(() => rebuildWindow(`renderer gone: ${details.reason}`), 500);
  });

  // Forwarded mousemoves stop when Clawd walks under a still cursor, which left clicks passing
  // through. So also report the cursor position and let the renderer hit-test it.
  let lastInside = false;
  const poll = setInterval(() => {
    if (w.isDestroyed()) return;
    const p = screen.getCursorScreenPoint();
    const b = w.getBounds();
    const inside = p.x >= b.x && p.x < b.x + b.width && p.y >= b.y && p.y < b.y + b.height;
    if (inside || lastInside) w.webContents.send('cursor', inside ? p.x - b.x : -1, inside ? p.y - b.y : -1);
    lastInside = inside;
  }, 50);
  w.on('closed', () => clearInterval(poll));
}

// Raw SVG markup for each animation, read once and handed to the renderer.
ipcMain.handle('load-assets', () => {
  const dir = path.join(__dirname, 'assets', 'raw');
  const out = {};
  for (const file of fs.readdirSync(dir)) {
    if (file.endsWith('.svg')) out[path.basename(file, '.svg')] = fs.readFileSync(path.join(dir, file), 'utf8');
  }
  return out;
});

ipcMain.handle('get-bounds', () => {
  const b = win.getBounds();
  const { workArea } = screen.getDisplayMatching(b);
  return { x: b.x, y: b.y, w: b.width, h: b.height, area: workArea };
});

// Everything the follow-the-mouse loop needs in one round trip.
ipcMain.handle('get-follow-info', () => {
  const b = win.getBounds();
  const { workArea } = screen.getDisplayMatching(b);
  return { cursor: screen.getCursorScreenPoint(), b: { x: b.x, y: b.y, w: b.width, h: b.height, area: workArea } };
});

ipcMain.on('set-pos', (_e, x, y) => {
  win.setBounds({ x: Math.round(x), y: Math.round(y), width: WIN_W, height: WIN_H });
});

ipcMain.on('set-ignore-mouse', (_e, ignore) => {
  win.setIgnoreMouseEvents(ignore, { forward: true });
});

ipcMain.on('show-menu', (_e, actions, prefs) => {
  const item = (a) => ({ label: a.label, click: () => win.webContents.send('run-action', a.name) });
  const toggle = (label, key) => ({
    label, type: 'checkbox', checked: prefs[key], click: (it) => win.webContents.send('set-setting', key, it.checked),
  });
  const menu = Menu.buildFromTemplate([
    ...actions.filter(a => a.group !== 'costume').map(item),
    { label: '装扮动作', submenu: actions.filter(a => a.group === 'costume').map(item) },
    { type: 'separator' },
    toggle('自动随机动作', 'auto'),
    toggle('声音', 'sound'),
    toggle('挨打要立正（不躲闪）', 'standStill'),
    toggle('跟随鼠标', 'follow'),
    {
      label: '全屏游戏/视频时自动隐藏', type: 'checkbox', checked: settings.hideOnFullscreen,
      click: (it) => { settings.hideOnFullscreen = it.checked; saveSettings(); if (!it.checked) setFullscreenHidden(false); },
    },
    { label: '回到右下角', click: () => { moveHome(); repaint(); } },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]);
  menu.popup({ window: win });
});

// Only one Clawd at a time: starting it again just calls the running one back home.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // Double-clicking the shortcut again always gives a fresh, visible Clawd at home.
  app.on('second-instance', () => rebuildWindow('started again'));
  app.whenReady().then(() => {
    loadSettings();
    createWindow();
    createTray();
    const stopWatching = watchFullscreen(
      (full) => setFullscreenHidden(full && settings.hideOnFullscreen),
      { ownPids: () => app.getAppMetrics().map((m) => m.pid) },
    );
    app.on('will-quit', stopWatching);
    for (const ev of ['resume', 'unlock-screen']) powerMonitor.on(ev, () => setTimeout(repaint, 800));
    screen.on('display-metrics-changed', () => setTimeout(repaint, 500));
    // Watchdog: a page that stops sending heartbeats (hung, or never booted) gets rebuilt.
    setInterval(() => {
      if (win && !win.isDestroyed() && !hiddenForFullscreen && Date.now() - lastBeat > 20000) rebuildWindow('no heartbeat');
    }, 5000);
  });
}
app.on('window-all-closed', () => app.quit());
