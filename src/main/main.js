const { app, BrowserWindow, Tray, Menu, ipcMain, clipboard, dialog, globalShortcut, nativeImage, session, webContents } = require('electron');
const path = require('path');
const fs = require('fs');
const { buildDeepSeekScript } = require(path.join(__dirname, '../shared/deepseekScript.js'));

let win = null;
let tray = null;
let floatWin = null;
let isAlwaysOnTop = true;

// 强制简体中文界面（DeepSeek 网页会跟随此语言）
app.commandLine.appendSwitch('lang', 'zh-CN');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());
}

// ---------- 本地记录（JSON 文件，只存时间/备注/链接，不含登录信息） ----------
const recordsPath = () => path.join(app.getPath('userData'), 'records.json');

function loadRecords() {
  try {
    return JSON.parse(fs.readFileSync(recordsPath(), 'utf8'));
  } catch {
    return [];
  }
}

function saveRecords(list) {
  fs.mkdirSync(path.dirname(recordsPath()), { recursive: true });
  fs.writeFileSync(recordsPath(), JSON.stringify(list, null, 2), 'utf8');
}

// ---------- 悬浮按钮位置记忆 ----------
const floatStatePath = () => path.join(app.getPath('userData'), 'float-state.json');

function loadFloatBounds() {
  try {
    return JSON.parse(fs.readFileSync(floatStatePath(), 'utf8'));
  } catch {
    return null;
  }
}

let floatSaveTimer = null;
function scheduleSaveFloatBounds() {
  clearTimeout(floatSaveTimer);
  floatSaveTimer = setTimeout(() => {
    if (!floatWin || floatWin.isDestroyed()) return;
    const b = floatWin.getBounds();
    fs.mkdirSync(path.dirname(floatStatePath()), { recursive: true });
    fs.writeFileSync(floatStatePath(), JSON.stringify(b), 'utf8');
  }, 300);
}

// ---------- 窗口 ----------
function createWindow() {
  win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 860,
    minHeight: 560,
    frame: false,           // 无边框
    resizable: true,        // 可调整大小
    alwaysOnTop: true,      // 始终置顶
    backgroundColor: '#f0fdf4',
    icon: path.join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true      // 允许渲染进程用 <webview> 内嵌 DeepSeek
    }
  });

  win.loadFile(path.join(__dirname, '../../dist-renderer/index.html'));

  win.on('closed', () => { win = null; });
}

function showWindow() {
  if (!win) {
    createWindow();
    return;
  }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function toggleWindow() {
  if (!win) return;
  if (win.isVisible()) {
    win.hide();
  } else {
    showWindow();
  }
}

// ---------- 悬浮按钮窗口 ----------
function createFloatWindow() {
  if (floatWin && !floatWin.isDestroyed()) return floatWin;
  floatWin = new BrowserWindow({
    width: 300,
    height: 168,
    minWidth: 260,
    minHeight: 130,
    frame: false,          // 无边框
    transparent: true,     // 透明背景，圆形悬浮球
    resizable: true,       // 可调整大小
    alwaysOnTop: true,     // 始终置顶
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  // 置顶级别提高到全屏 PPT 之上
  floatWin.setAlwaysOnTop(true, 'screen-saver');

  // 恢复上次位置（尺寸做下限保护，避免旧的小尺寸挤压面板）
  const saved = loadFloatBounds();
  if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
    floatWin.setBounds({
      x: saved.x,
      y: saved.y,
      width: Math.max(saved.width || 300, 260),
      height: Math.max(saved.height || 168, 130)
    });
  }

  floatWin.loadFile(path.join(__dirname, '../../dist-renderer/float.html'));
  floatWin.on('moved', scheduleSaveFloatBounds);
  floatWin.on('resized', scheduleSaveFloatBounds);
  floatWin.on('closed', () => { floatWin = null; });
  return floatWin;
}

function showFloating() {
  const w = createFloatWindow();
  if (w.isMinimized()) w.restore();
  w.showInactive(); // 不抢焦点，不影响老师正在用的 PPT
}

function hideFloating() {
  if (floatWin && !floatWin.isDestroyed()) floatWin.hide();
}

function toggleFloating() {
  if (floatWin && !floatWin.isDestroyed() && floatWin.isVisible()) hideFloating();
  else showFloating();
}

// ---------- 托盘 ----------
function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, '../../build/tray.png'));
  tray = new Tray(icon);
  tray.setToolTip('无土栽培AI助手');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示主窗口', click: showWindow },
    { label: '隐藏主窗口', click: () => win && win.hide() },
    { type: 'separator' },
    { label: '显示悬浮按钮', click: showFloating },
    { label: '隐藏悬浮按钮', click: hideFloating },
    { type: 'separator' },
    {
      label: '置顶：开',
      type: 'checkbox',
      checked: true,
      click: (item) => {
        isAlwaysOnTop = item.checked;
        if (win) win.setAlwaysOnTop(isAlwaysOnTop);
      }
    },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ]));
  tray.on('click', toggleWindow);
}

// ---------- IPC ----------
function registerIpc() {
  ipcMain.handle('prompt:copy', (_e, text) => {
    clipboard.writeText(String(text || ''));
    return true;
  });

  ipcMain.handle('record:list', () => loadRecords());

  ipcMain.handle('record:add', (_e, { note, link }) => {
    const list = loadRecords();
    list.unshift({
      id: Date.now(),
      time: new Date().toLocaleString('zh-CN', { hour12: false }),
      note: String(note || ''),
      link: String(link || '')
    });
    if (list.length > 500) list.length = 500;
    saveRecords(list);
    return list;
  });

  ipcMain.handle('record:delete', (_e, id) => {
    saveRecords(loadRecords().filter((r) => r.id !== id));
    return true;
  });

  ipcMain.handle('qr:save', async (_e, dataURL) => {
    try {
      // 保存到 桌面/无土栽培AI助手/二维码/，目录不存在则自动创建
      const dir = path.join(app.getPath('desktop'), '无土栽培AI助手', '二维码');
      fs.mkdirSync(dir, { recursive: true });
      const p = (n) => String(n).padStart(2, '0');
      const d = new Date();
      const name = `AI对话分享_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.png`;
      const file = path.join(dir, name);
      fs.writeFileSync(file, Buffer.from(String(dataURL).split(',')[1], 'base64'));
      return { ok: true, path: file };
    } catch (err) {
      return { ok: false, message: err.message };
    }
  });

  ipcMain.handle('win:hide', () => { win && win.hide(); });
  ipcMain.handle('main:show', () => showWindow());
  ipcMain.handle('float:show', () => showFloating());
  ipcMain.handle('float:hide', () => hideFloating());
  ipcMain.handle('float:toggle', () => toggleFloating());

  // 悬浮球手动拖动：渲染层上报屏幕鼠标坐标，主进程同步移动窗口
  let floatDragOffset = null;
  ipcMain.on('float:drag-start', (_e, { x, y }) => {
    if (!floatWin || floatWin.isDestroyed()) return;
    const b = floatWin.getBounds();
    floatDragOffset = { x: Math.round(x - b.x), y: Math.round(y - b.y) };
  });
  ipcMain.on('float:drag-move', (_e, { x, y }) => {
    if (!floatWin || floatWin.isDestroyed() || !floatDragOffset) return;
    floatWin.setPosition(Math.round(x - floatDragOffset.x), Math.round(y - floatDragOffset.y));
  });
  ipcMain.on('float:drag-end', () => {
    floatDragOffset = null;
    scheduleSaveFloatBounds();
  });

  // ---------- DeepSeek 自动填入/发送（主进程统一执行，悬浮窗与主窗口共用） ----------
  function findDeepSeekContents() {
    return webContents.getAllWebContents().find(
      (wc) => !wc.isDestroyed() && (wc.getURL() || '').includes('chat.deepseek.com')
    );
  }

  async function runDeepSeekScript(text, autoSend) {
    const wc = findDeepSeekContents();
    if (!wc) return { ok: false, reason: 'no-webview' };
    const start = Date.now();
    while (wc.isLoading()) {
      if (Date.now() - start > 15000) return { ok: false, reason: 'loading' };
      await new Promise((r) => setTimeout(r, 400));
    }
    try {
      const result = await wc.executeJavaScript(buildDeepSeekScript(text, autoSend), true);
      return result || { ok: false, reason: 'error' };
    } catch (err) {
      return { ok: false, reason: 'error', message: err.message };
    }
  }

  ipcMain.handle('deepseek:send', (_e, text) => runDeepSeekScript(text, true));
  ipcMain.handle('deepseek:fill', (_e, text) => runDeepSeekScript(text, false));
  ipcMain.handle('win:minimize', () => { win && win.minimize(); });
  ipcMain.handle('win:maximize', () => {
    if (!win) return;
    win.isMaximized() ? win.unmaximize() : win.maximize();
  });
  ipcMain.handle('win:toggleTop', () => {
    isAlwaysOnTop = !isAlwaysOnTop;
    if (win) win.setAlwaysOnTop(isAlwaysOnTop);
    return isAlwaysOnTop;
  });
  ipcMain.handle('win:quit', () => app.quit());
}

// ---------- 生命周期 ----------
app.whenReady().then(() => {
  // DeepSeek 会话的请求头带中文语言标记，保证网页以中文界面加载
  session.fromPartition('persist:deepseek').webRequest.onBeforeSendHeaders(
    (details, callback) => {
      details.requestHeaders['Accept-Language'] = 'zh-CN,zh;q=0.9';
      callback({ requestHeaders: details.requestHeaders });
    }
  );

  registerIpc();
  createWindow();
  createTray();
  createFloatWindow(); // 预创建，隐藏状态，比赛模式点「开始使用 AI」后显示

  // 全局快捷键：Ctrl+Alt+A 隐藏/显示助手
  globalShortcut.register('CommandOrControl+Alt+A', toggleWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else showWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
