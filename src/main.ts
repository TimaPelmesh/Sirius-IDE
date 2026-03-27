import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as http from 'http';
import * as fse from 'fs-extra';
import { spawn } from 'child_process';
import { fileHandlers } from './fileHandlers';
import { addAllowedRoot, validatePath } from './pathValidator';
import * as terminalHandler from './terminalHandler';
import simpleGit from 'simple-git';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const chokidar = require('chokidar');

const LM_STUDIO_URL = 'http://127.0.0.1:1234/v1';
const ABORT_MESSAGE = 'Запрос остановлен';

let mainWindow: BrowserWindow | null = null;
let lmStudioAbortController: AbortController | null = null;
let fsWatcher: ReturnType<typeof chokidar.watch> | null = null;
let rendererBaseUrl: string = '';

// In-memory state survives renderer reload (Ctrl+R)
let rendererState: { root?: string; active?: string; files?: Record<string, string> } | null = null;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.map': 'application/json',
};

function createStaticServer(appRoot: string): http.Server {
  return http.createServer((req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      let p = decodeURIComponent(url.pathname).replace(/^\/+/, '').replace(/\/+/g, '/') || 'renderer/index.html';
      if (p === '') p = 'renderer/index.html';
      const filePath = path.resolve(appRoot, p.split('/').join(path.sep));
      const relative = path.relative(appRoot, filePath);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        res.writeHead(403); res.end(); return;
      }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(err.code === 'ENOENT' ? 404 : 500); res.end(); return;
        }
        const ext = path.extname(filePath);
        res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
        res.writeHead(200); res.end(data);
      });
    } catch (_) {
      res.writeHead(400); res.end();
    }
  });
}

function startStaticServer(port: number = 0): Promise<string> {
  const appRoot = path.resolve(path.join(__dirname, '..'));
  return new Promise((resolve, reject) => {
    const server = createStaticServer(appRoot);
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address();
      const p = typeof addr === 'object' && addr ? addr.port : port || 9876;
      resolve(`http://127.0.0.1:${p}`);
    });
    server.on('error', reject);
  });
}

function createWindow() {
  const appRoot = path.join(__dirname, '..');
  const iconBuild = path.join(appRoot, 'build', 'icon.ico');
  const iconRoot = path.join(appRoot, 'icon.ico');
  const iconPath = fs.existsSync(iconBuild) ? iconBuild : (fs.existsSync(iconRoot) ? iconRoot : undefined);

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 500,
    frame: false,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  mainWindow.loadURL(`${rendererBaseUrl}/renderer/index.html`);
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('maximize',   () => mainWindow?.webContents.send('win-maximized', true));
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('win-maximized', false));

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

// ── File handlers ────────────────────────────────────────────
Object.entries(fileHandlers).forEach(([channel, handler]) => {
  ipcMain.handle(channel, handler);
});

// ── Window controls ──────────────────────────────────────────
ipcMain.on('win-minimize', () => mainWindow?.minimize());
ipcMain.on('win-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('zoom-in', () => {
  if (!mainWindow) return;
  const wc = mainWindow.webContents;
  wc.setZoomLevel(wc.getZoomLevel() + 0.5);
});
ipcMain.on('zoom-out', () => {
  if (!mainWindow) return;
  const wc = mainWindow.webContents;
  wc.setZoomLevel(wc.getZoomLevel() - 0.5);
});
ipcMain.on('zoom-reset', () => {
  mainWindow?.webContents.setZoomLevel(0);
});
ipcMain.on('win-close', () => mainWindow?.close());
ipcMain.on('open-devtools', () => mainWindow?.webContents.openDevTools());
ipcMain.handle('win-is-maximized', () => mainWindow?.isMaximized() || false);

// ── LM Studio proxy (обход CORS: запросы из main, страница на 127.0.0.1:PORT) ──
ipcMain.handle('lmstudio-models', async () => {
  try {
    const r = await fetch(`${LM_STUDIO_URL}/models`);
    const data = await r.json();
    return data;
  } catch (_) {
    return null;
  }
});

ipcMain.on('lmstudio-abort', () => {
  if (lmStudioAbortController) {
    lmStudioAbortController.abort();
    lmStudioAbortController = null;
  }
});

ipcMain.handle('lmstudio-stream', async (_: unknown, payload: unknown) => {
  const win = mainWindow;
  if (!win?.webContents) return;
  const messages = Array.isArray(payload) ? payload : (payload as { messages?: unknown[] })?.messages;
  if (!messages || !Array.isArray(messages)) return;
  const opts = typeof payload === 'object' && payload !== null && !Array.isArray(payload) ? (payload as { temperature?: number; max_tokens?: number; response_format?: unknown }) : {};
  const temperature = typeof opts.temperature === 'number' ? opts.temperature : 0.4;
  const max_tokens = typeof opts.max_tokens === 'number' ? opts.max_tokens : 32768;
  const body: Record<string, unknown> = {
    model: '',
    messages,
    stream: true,
    temperature,
    max_tokens,
  };
  if (opts.response_format && typeof opts.response_format === 'object') body.response_format = opts.response_format;

  lmStudioAbortController = new AbortController();
  const signal = lmStudioAbortController.signal;
  try {
    const resp = await fetch(`${LM_STUDIO_URL}/chat/completions`, {
      signal,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    lmStudioAbortController = null;
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    if (!resp.body) throw new Error('No response body');
    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
        try {
          const j = JSON.parse(line.slice(6)) as { choices?: Array<{ delta?: { content?: string } }> };
          const delta = j.choices?.[0]?.delta?.content;
          if (delta) win.webContents.send('lmstudio-chunk', delta);
        } catch (_) {}
      }
    }
    win.webContents.send('lmstudio-stream-end');
  } catch (e) {
    lmStudioAbortController = null;
    const err = e as Error;
    const msg = err.name === 'AbortError' ? ABORT_MESSAGE : (err?.message ?? String(e));
    win.webContents.send('lmstudio-stream-error', msg);
  }
});

// ── Renderer state (survives Ctrl+R) ──────────────────────────
ipcMain.handle('store-renderer-state', (_: unknown, data: string) => {
  try {
    rendererState = JSON.parse(data);
    if (rendererState?.root) addAllowedRoot(rendererState.root);
  } catch (_) { rendererState = null; }
});
ipcMain.handle('get-renderer-state', () => rendererState);

// ── Open folder dialog ───────────────────────────────────────
ipcMain.handle('open-folder-dialog', async () => {
  return dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
    title: 'Выберите папку проекта',
  });
});

// ── File watcher (chokidar) ──────────────────────────────────
ipcMain.handle('watch-dir', (_: unknown, dirPath: string) => {
  addAllowedRoot(dirPath);
  if (fsWatcher) { fsWatcher.close(); fsWatcher = null; }
  try {
    fsWatcher = chokidar.watch(dirPath, {
      ignored: /(^|[/\\])\.|node_modules/,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
    });
    const send = (evt: string, p: string) => mainWindow?.webContents.send('fs-change', evt, p);
    fsWatcher.on('add',       (p: string) => send('add', p));
    fsWatcher.on('change',    (p: string) => send('change', p));
    fsWatcher.on('unlink',    (p: string) => send('unlink', p));
    fsWatcher.on('addDir',    (p: string) => send('addDir', p));
    fsWatcher.on('unlinkDir', (p: string) => send('unlinkDir', p));
  } catch (_) { /* drive not watchable */ }
});

ipcMain.handle('unwatch-dir', () => {
  fsWatcher?.close();
  fsWatcher = null;
});

// ── Git status ───────────────────────────────────────────────
ipcMain.handle('git-status', async (_: unknown, dirPath: string) => {
  validatePath(dirPath);
  try {
    const git = simpleGit(dirPath);
    const isRepo = await git.checkIsRepo().catch(() => false);
    if (!isRepo) return null;
    const [branch, status] = await Promise.all([
      git.revparse(['--abbrev-ref', 'HEAD']).catch(() => 'HEAD'),
      git.status().catch(() => null),
    ]);
    return {
      branch: branch.trim(),
      modified: status?.modified.length ?? 0,
      staged:   status?.staged.length   ?? 0,
      ahead:    status?.ahead           ?? 0,
      behind:   status?.behind          ?? 0,
    };
  } catch (_) { return null; }
});

// ── Terminal ─────────────────────────────────────────────────
ipcMain.handle('terminal-create', () => {
  const id = crypto.randomUUID();
  const cwd = process.env.HOME || process.env.USERPROFILE || process.cwd();
  const ok = terminalHandler.createTerminal(cwd, id, (data) => {
    mainWindow?.webContents.send('terminal-data', id, data);
  });
  return ok ? id : null;
});

ipcMain.handle('terminal-create-in-cwd', (_: unknown, cwd: string) => {
  const dir = cwd || process.env.HOME || process.env.USERPROFILE || process.cwd();
  if (cwd) validatePath(dir);
  const id = crypto.randomUUID();
  const ok = terminalHandler.createTerminal(dir, id, (data) => {
    mainWindow?.webContents.send('terminal-data', id, data);
  });
  return ok ? id : null;
});

ipcMain.handle('terminal-write',  (_: unknown, id: string, data: string) => terminalHandler.writeToTerminal(id, data));
ipcMain.handle('terminal-resize', (_: unknown, id: string, cols: number, rows: number) => terminalHandler.resizeTerminal(id, cols, rows));
ipcMain.handle('terminal-kill',   (_: unknown, id: string) => terminalHandler.killTerminal(id));

// ── Fix folder permissions (Windows UAC) ─────────────────────
ipcMain.handle('fix-folder-permissions', async (_: unknown, dirPath: string) => {
  if (process.platform !== 'win32') return false;
  validatePath(dirPath);

  const tmpBat = path.join(os.tmpdir(), 'sirius_fix_perms.bat');
  const username = process.env.USERNAME || process.env.USER || 'Users';
  // Grant full control recursively (OI)(CI) = object/container inherit
  const bat = [
    '@echo off',
    'chcp 65001 > nul',
    `echo Исправление прав доступа для папки:`,
    `echo ${dirPath}`,
    `echo.`,
    `icacls "${dirPath}" /grant "${username}:(OI)(CI)F" /T /C`,
    `echo.`,
    `if %errorlevel%==0 (`,
    `  echo Готово! Права успешно установлены.`,
    `) else (`,
    `  echo Ошибка. Попробуйте вручную через Свойства папки ^> Безопасность.`,
    `)`,
    `echo.`,
    `pause`,
  ].join('\r\n');

  try {
    await fse.writeFile(tmpBat, bat, 'utf8');
    return await new Promise<boolean>((resolve) => {
      // Start-Process -Verb RunAs triggers Windows UAC
      // Do NOT use -Wait: resolve immediately after UAC spawn, don't block IPC
      const ps = spawn('powershell.exe', [
        '-NonInteractive', '-Command',
        `Start-Process cmd.exe -Verb RunAs -ArgumentList '/c "${tmpBat}"'`,
      ]);
      // Resolve quickly — the elevated cmd window runs independently
      ps.on('spawn', () => setTimeout(() => resolve(true), 500));
      ps.on('error', () => resolve(false));
      // Safety timeout: 8s max wait
      setTimeout(() => resolve(false), 8000);
    });
  } catch (_err) {
    return false;
  }
});

// ── New Window: disabled — focus main window instead ─────────
ipcMain.handle('new-window', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// ── App lifecycle ────────────────────────────────────────────
// Single-instance lock — prevent running multiple copies
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      rendererBaseUrl = await startStaticServer(0);
    } catch (e) {
      console.error('Static server (random port) failed:', e);
      try {
        rendererBaseUrl = await startStaticServer(9876);
      } catch (_) {
        dialog.showErrorBox('Sirius IDE', 'Не удалось запустить локальный сервер. Редактор работает только по HTTP. Закройте другие копии приложения или освободите порт 9876.');
        app.quit();
        return;
      }
    }
    createWindow();
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
}
