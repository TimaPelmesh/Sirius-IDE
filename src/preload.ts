import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // ── Files ──────────────────────────────────────────────────
  readFile:  (path: string) => ipcRenderer.invoke('read-file', path),
  readFileSafe: (path: string) => ipcRenderer.invoke('read-file-safe', path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('write-file', path, content),
  readDir:   (path: string) => ipcRenderer.invoke('read-dir', path),
  exists:    (path: string) => ipcRenderer.invoke('exists', path),
  mkdir:     (path: string) => ipcRenderer.invoke('mkdir', path),
  stat:      (path: string) => ipcRenderer.invoke('stat', path),
  rename:    (oldPath: string, newPath: string) => ipcRenderer.invoke('rename', oldPath, newPath),
  delete:    (path: string) => ipcRenderer.invoke('delete', path),
  copyPath:  (src: string, dest: string) => ipcRenderer.invoke('copy-path', src, dest),
  saveProjectState: (data: string) => ipcRenderer.invoke('save-project-state', data),
  loadProjectState: () => ipcRenderer.invoke('load-project-state'),
  storeRendererState: (data: string) => ipcRenderer.invoke('store-renderer-state', data),
  getRendererState: () => ipcRenderer.invoke('get-renderer-state'),

  // ── Dialog ─────────────────────────────────────────────────
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),

  // ── File Watcher ───────────────────────────────────────────
  watchDir:   (dir: string) => ipcRenderer.invoke('watch-dir', dir),
  unwatchDir: () => ipcRenderer.invoke('unwatch-dir'),
  onFsChange: (cb: (event: string, path: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, event: string, path: string) => cb(event, path);
    ipcRenderer.on('fs-change', handler);
    return () => ipcRenderer.removeListener('fs-change', handler);
  },

  // ── Git ────────────────────────────────────────────────────
  gitStatus: (dir: string) => ipcRenderer.invoke('git-status', dir),

  // ── Terminal ───────────────────────────────────────────────
  terminalCreate:       () => ipcRenderer.invoke('terminal-create'),
  terminalCreateInCwd:  (cwd: string) => ipcRenderer.invoke('terminal-create-in-cwd', cwd),
  terminalWrite:        (id: string, data: string) => ipcRenderer.invoke('terminal-write', id, data),
  terminalResize:       (id: string, cols: number, rows: number) => ipcRenderer.invoke('terminal-resize', id, cols, rows),
  terminalKill:         (id: string) => ipcRenderer.invoke('terminal-kill', id),

  // Returns a cleanup function to avoid IPC listener accumulation
  terminalOnData: (callback: (id: string, data: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, id: string, data: string) => callback(id, data);
    ipcRenderer.on('terminal-data', handler);
    return () => ipcRenderer.removeListener('terminal-data', handler);
  },

  // ── System ─────────────────────────────────────────────────
  fixFolderPermissions: (dir: string) => ipcRenderer.invoke('fix-folder-permissions', dir),

  // ── LM Studio (proxy через main, без CORS) ─────────────────
  getLMStudioModels: () => ipcRenderer.invoke('lmstudio-models'),
  streamLMStudioChat: (payload: { messages: unknown[]; temperature?: number; max_tokens?: number; response_format?: unknown }) => ipcRenderer.invoke('lmstudio-stream', payload),
  abortLMStudioStream: () => ipcRenderer.send('lmstudio-abort'),
  onLMStudioChunk: (cb: (chunk: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, chunk: string) => cb(chunk);
    ipcRenderer.on('lmstudio-chunk', handler);
    return () => ipcRenderer.removeListener('lmstudio-chunk', handler);
  },
  onLMStudioStreamEnd: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on('lmstudio-stream-end', handler);
    return () => ipcRenderer.removeListener('lmstudio-stream-end', handler);
  },
  onLMStudioStreamError: (cb: (err: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, err: string) => cb(err);
    ipcRenderer.on('lmstudio-stream-error', handler);
    return () => ipcRenderer.removeListener('lmstudio-stream-error', handler);
  },

  // ── Window ─────────────────────────────────────────────────
  openDevTools:   () => ipcRenderer.send('open-devtools'),
  newWindow:      () => ipcRenderer.invoke('new-window'),
  zoomIn:         () => ipcRenderer.send('zoom-in'),
  zoomOut:        () => ipcRenderer.send('zoom-out'),
  zoomReset:      () => ipcRenderer.send('zoom-reset'),
  winMinimize:    () => ipcRenderer.send('win-minimize'),
  winMaximize:    () => ipcRenderer.send('win-maximize'),
  winClose:       () => ipcRenderer.send('win-close'),
  winIsMaximized: () => ipcRenderer.invoke('win-is-maximized'),
  onMaximized:    (cb: (v: boolean) => void) => ipcRenderer.on('win-maximized', (_, v) => cb(v)),
});
