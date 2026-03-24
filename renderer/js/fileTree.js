/* Sirius IDE — fileTree.js */
'use strict';

const RUN_CONFIGS = [
  ['package.json',      null,             null,           'npm',    '⬡'],
  ['requirements.txt',  'python main.py', null,           'python', '🐍'],
  ['main.py',           'python main.py', null,           'python', '🐍'],
  ['app.py',            'python app.py',  null,           'python', '🐍'],
  ['index.html',        null,             null,           'HTML',   '🌐'],
  ['Makefile',          'make',           'make build',   'make',   '⚙'],
  ['Cargo.toml',        'cargo run',      'cargo build',  'cargo',  '🦀'],
  ['go.mod',            'go run .',       'go build',     'go',     '🔵'],
  ['pom.xml',           'mvn compile',    'mvn package',  'mvn',    '☕'],
];

let _runCmd = null;
let _buildCmd = null;
let _gitErrorCount = 0;
let _isUndoingExplorer = false;
const _explorerUndoStack = [];
const EXPLORER_UNDO_LIMIT = 30;

function pushExplorerUndo(action) {
  if (_isUndoingExplorer) return;
  _explorerUndoStack.push(action);
  if (_explorerUndoStack.length > EXPLORER_UNDO_LIMIT) _explorerUndoStack.shift();
}

// Множественный выбор в дереве (Ctrl+click)
const selectedTreePaths = new Set();
function getSelectedTreePaths() { return Array.from(selectedTreePaths); }

async function loadProject(openFirst = true) {
  if (!projectRoot) return;
  hideWelcome();
  await refreshTree();
  window.api.watchDir(projectRoot).catch(() => {});
  _gitErrorCount = 0;
  updateGitStatus();
  detectRunCommand();
}

async function detectRunCommand() {
  var btn = $('btn-run');
  if (!btn || !projectRoot) return;
  btn.style.display = 'none';
  const pkgPath = projectRoot + '\\package.json';
  if (await window.api.exists(pkgPath)) {
    try {
      const pkg = JSON.parse(await window.api.readFile(pkgPath));
      const scripts = pkg.scripts || {};
      _runCmd   = scripts.dev   ? 'npm run dev'
                : scripts.start ? 'npm start'
                : scripts.serve ? 'npm run serve'
                : null;
      _buildCmd = scripts.build ? 'npm run build' : null;
    } catch (_) {}
  } else {
    for (const [file, run, build] of RUN_CONFIGS.slice(1)) {
      if (await window.api.exists(projectRoot + '\\' + file)) {
        _runCmd = run;
        _buildCmd = build;
        break;
      }
    }
    if (!_runCmd && await window.api.exists(projectRoot + '\\index.html')) {
      _runCmd = `start "" "${projectRoot}\\index.html"`;
    }
  }
}

async function runProject() {
  const cmd = _runCmd || _buildCmd;
  if (!cmd) { toast('Команда запуска не определена', 'info'); return; }
  const panel = $('term-panel');
  if (!panel || !panel.classList.contains('open')) toggleTerminal();
  await new Promise(r => setTimeout(r, activeTermId ? 30 : 600));
  const inst = termInstances.get(activeTermId);
  if (!inst?.backendId) {
    toast('Терминал недоступен, перезапусти IDE', 'error');
    return;
  }
  var runBtn = $('btn-run');
  if (runBtn) { runBtn.classList.add('running'); }
  var runLabel = $('run-label');
  if (runLabel) runLabel.textContent = '■ Stop';
  window.api.terminalWrite(inst.backendId, cmd + '\r');
  setTimeout(function () {
    if (runBtn) runBtn.classList.remove('running');
    if (runLabel) runLabel.textContent = cmd;
  }, 5000);
}

async function updateGitStatus() {
  if (!projectRoot) return;
  if (_gitErrorCount >= 3) return;
  const folderName = projectRoot.split(/[\\/]/).pop() || projectRoot;
  const gitIcon = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>`;
  try {
    const status = await window.api.gitStatus(projectRoot);
    _gitErrorCount = 0;
    const el = $('sb-branch');
    if (status && status.branch) {
      const dirty = (status.modified || 0) + (status.staged || 0);
      const txt = status.branch + (dirty ? ` ●${dirty}` : '');
      el.innerHTML = `${gitIcon} ${txt}`;
      el.title = `Ветка: ${status.branch} | Изменено: ${status.modified} | В индексе: ${status.staged}`;
    } else {
      el.innerHTML = `${gitIcon} ${folderName}`;
      el.title = projectRoot;
    }
  } catch (_) {
    _gitErrorCount++;
    const el = $('sb-branch');
    if (el) el.innerHTML = `${gitIcon} ${folderName}`;
  }
}

async function doMove(srcPath, destPath) {
  const affectedPaths = Object.keys(openFiles).filter(p =>
    p === srcPath || p.startsWith(srcPath + '\\') || p.startsWith(srcPath + '/')
  );
  const wasActiveAffected = affectedPaths.includes(activeFile);
  const newActivePath = wasActiveAffected
    ? destPath + activeFile.slice(srcPath.length)
    : null;
  for (const p of affectedPaths) {
    const suffix = p.slice(srcPath.length);
    const newP   = destPath + suffix;
    openFiles[newP] = openFiles[p];
    delete openFiles[p];
    const oldModel = monaco?.editor?.getModel(monaco.Uri.file(p));
    if (oldModel) oldModel.dispose();
  }
  await window.api.rename(srcPath, destPath);
  if (wasActiveAffected) {
    activeFile = null;
    await openFile(newActivePath);
  }
  if (!_isUndoingExplorer) pushExplorerUndo({ type: 'move', from: srcPath, to: destPath });
}

function clearDragOver() {
  if (_dragCurrentOver) {
    _dragCurrentOver.classList.remove('drag-over');
    _dragCurrentOver = null;
  }
}

function makeDraggable(item, path, isDir, name) {
  const handle = document.createElement('span');
  handle.className = 'tree-drag-handle';
  handle.setAttribute('draggable', 'true');
  handle.title = 'Перетащить (Alt = копировать)';
  handle.innerHTML =
    '<svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor">' +
    '<circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>' +
    '<circle cx="2" cy="6" r="1.2"/><circle cx="6" cy="6" r="1.2"/>' +
    '<circle cx="2" cy="10" r="1.2"/><circle cx="6" cy="10" r="1.2"/></svg>';
  item.appendChild(handle);
  handle.addEventListener('dragstart', ev => {
    ev.stopPropagation();
    _dragSrc = { path, isDir, name };
    ev.dataTransfer.effectAllowed = 'copyMove';
    ev.dataTransfer.setData('text/plain', path);
    try { ev.dataTransfer.setDragImage(item, 16, 10); } catch (_) {}
    requestAnimationFrame(() => item.classList.add('dragging'));
  });
  handle.addEventListener('dragend', () => {
    item.classList.remove('dragging');
    clearDragOver();
    _dragSrc = null;
  });
  item.addEventListener('dragover', ev => {
    if (!_dragSrc || _dragSrc.path === path) return;
    ev.preventDefault();
    ev.stopPropagation();
    ev.dataTransfer.dropEffect = ev.altKey ? 'copy' : 'move';
    if (_dragCurrentOver !== item) {
      clearDragOver();
      _dragCurrentOver = item;
      item.classList.add('drag-over');
    }
  });
  item.addEventListener('dragleave', ev => {
    if (_dragCurrentOver === item && !item.contains(ev.relatedTarget)) {
      item.classList.remove('drag-over');
      _dragCurrentOver = null;
    }
  });
  item.addEventListener('drop', async ev => {
    ev.preventDefault();
    ev.stopPropagation();
    clearDragOver();
    if (!_dragSrc || _dragSrc.path === path) { _dragSrc = null; return; }
    const targetDir = isDir ? path : path.replace(/[\\/][^\\/]+$/, '');
    if (_dragSrc.isDir &&
        (targetDir === _dragSrc.path ||
         targetDir.startsWith(_dragSrc.path + '\\') ||
         targetDir.startsWith(_dragSrc.path + '/'))) {
      toast('Нельзя переместить папку в саму себя', 'error');
      _dragSrc = null;
      return;
    }
    const newPath = targetDir.replace(/[\\/]$/, '') + '\\' + _dragSrc.name;
    if (newPath === _dragSrc.path) { _dragSrc = null; return; }
    const isCopy = ev.altKey;
    const src = _dragSrc;
    _dragSrc = null;
    try {
      if (isCopy) {
        await window.api.copyPath(src.path, newPath);
        toast(`Скопировано: ${src.name}`, 'success');
      } else {
        await doMove(src.path, newPath);
        toast(`Перемещено: ${src.name}`, 'success');
      }
      await refreshTree();
      refreshTabs();
    } catch (err) {
      toast(`Ошибка: ${err.message}`, 'error');
    }
  });
}

function clipboardCopy(path, isDir, name) {
  if (_clipboard?.op === 'cut') {
    document.querySelectorAll('.tree-item.clipboard-cut')
      .forEach(el => el.classList.remove('clipboard-cut'));
  }
  _clipboard = { items: [{ path, isDir, name }], op: 'copy' };
  toast(`Скопировано: ${name}`, 'info', 1500);
}

function clipboardCut(path, isDir, name) {
  document.querySelectorAll('.tree-item.clipboard-cut')
    .forEach(el => el.classList.remove('clipboard-cut'));
  _clipboard = { items: [{ path, isDir, name }], op: 'cut' };
  const el = document.querySelector(`.tree-item[data-path="${CSS.escape(path)}"]`);
  if (el) el.classList.add('clipboard-cut');
  toast(`Вырезано: ${name}`, 'info', 1500);
}

async function copySelectionToClipboard() {
  const paths = getSelectedTreePaths().length ? getSelectedTreePaths() : (activeFile ? [activeFile] : []);
  if (!paths.length) { toast('Выберите файл или папку', 'info'); return; }
  if (_clipboard?.op === 'cut') {
    document.querySelectorAll('.tree-item.clipboard-cut')
      .forEach(el => el.classList.remove('clipboard-cut'));
  }
  const items = [];
  for (const p of paths) {
    try {
      const s = await window.api.stat(p);
      items.push({ path: p, isDir: s.isDirectory, name: p.replace(/^.*[\\/]/, '') });
    } catch (_) {}
  }
  if (!items.length) return;
  _clipboard = { items, op: 'copy' };
  toast(items.length > 1 ? `Скопировано: ${items.length} элементов` : `Скопировано: ${items[0].name}`, 'info', 1500);
}

async function cutSelectionToClipboard() {
  const paths = getSelectedTreePaths().length ? getSelectedTreePaths() : (activeFile ? [activeFile] : []);
  if (!paths.length) { toast('Выберите файл или папку', 'info'); return; }
  document.querySelectorAll('.tree-item.clipboard-cut')
    .forEach(el => el.classList.remove('clipboard-cut'));
  const items = [];
  for (const p of paths) {
    try {
      const s = await window.api.stat(p);
      items.push({ path: p, isDir: s.isDirectory, name: p.replace(/^.*[\\/]/, '') });
      const el = document.querySelector(`.tree-item[data-path="${CSS.escape(p)}"]`);
      if (el) el.classList.add('clipboard-cut');
    } catch (_) {}
  }
  if (!items.length) return;
  _clipboard = { items, op: 'cut' };
  toast(items.length > 1 ? `Вырезано: ${items.length} элементов` : `Вырезано: ${items[0].name}`, 'info', 1500);
}

function getPasteTargetDir() {
  const sel = getSelectedTreePaths();
  const first = sel[0];
  if (first) return first.replace(/[\\/][^\\/]+$/, '');
  if (activeFile) return activeFile.replace(/[\\/][^\\/]+$/, '');
  return projectRoot || '';
}

async function deleteSelectionOrActive() {
  const paths = getSelectedTreePaths().length ? getSelectedTreePaths() : (activeFile ? [activeFile] : []);
  if (!paths.length) { toast('Выберите файл или папку', 'info'); return; }
  const sep = projectRoot && projectRoot.indexOf('/') !== -1 ? '/' : '\\';
  const norm = p => (p || '').replace(/\//g, sep).replace(/\\+/g, sep);
  const isUnder = (child, parent) => {
    const c = norm(child); const p = norm(parent);
    return c === p || (c.startsWith(p) && (c[p.length] === sep || c[p.length] === '/'));
  };
  const msg = paths.length > 1
    ? `Удалить выбранные элементы (${paths.length})? Это действие необратимо.`
    : `Удалить "${paths[0].replace(/^.*[\\/]/, '')}"? Это действие необратимо.`;
  const ok = await showConfirm(msg);
  if (!ok) return;
  const toClose = Object.keys(openFiles || {}).filter(openPath =>
    paths.some(delPath => isUnder(openPath, delPath))
  );
  for (const p of toClose) closeTab(p);
  const sorted = paths.slice().sort((a, b) => b.length - a.length);
  async function snapshotPath(p) {
    const st = await window.api.stat(p);
    if (!st || !st.isDirectory) {
      return { kind: 'file', content: await window.api.readFile(p) };
    }
    const entries = await window.api.readDir(p);
    const children = [];
    for (const e of entries) {
      children.push({ name: e.name, data: await snapshotPath(e.path) });
    }
    return { kind: 'dir', children };
  }
  async function restoreSnapshot(path, snap) {
    if (!snap) return;
    if (snap.kind === 'file') {
      const parent = path.replace(/[\\/][^\\/]+$/, '');
      await ensureDir(parent);
      await window.api.writeFile(path, snap.content || '');
      return;
    }
    await ensureDir(path);
    for (const child of (snap.children || [])) {
      const childPath = path.replace(/[\\/]$/, '') + '\\' + child.name;
      await restoreSnapshot(childPath, child.data);
    }
  }
  async function ensureDir(dir) {
    if (!dir) return;
    if (await window.api.exists(dir)) return;
    const parent = dir.replace(/[\\/][^\\/]+$/, '');
    if (parent && parent !== dir) await ensureDir(parent);
    await window.api.mkdir(dir);
  }
  const snapshots = [];
  for (const p of sorted) {
    try { snapshots.push({ path: p, data: await snapshotPath(p) }); } catch (_) {}
  }
  try {
    for (const p of sorted) await window.api.delete(p);
    selectedTreePaths.clear();
    if (!_isUndoingExplorer) pushExplorerUndo({ type: 'delete', snapshots });
    toast(paths.length > 1 ? `Удалено: ${paths.length} элементов` : 'Удалено', 'success');
    await refreshTree();
    refreshTabs();
  } catch (e) {
    toast('Ошибка удаления: ' + e.message, 'error');
  }
}

async function getUniqueDestPath(targetDir, baseName) {
  const sep = projectRoot && projectRoot.indexOf('/') !== -1 ? '/' : '\\';
  const dir = targetDir.replace(/[\\/]$/, '');
  const base = dir + sep + baseName;
  if (!(await window.api.exists(base))) return base;
  const dot = baseName.lastIndexOf('.');
  const ext = dot > 0 ? baseName.slice(dot) : '';
  const nameWithoutExt = dot > 0 ? baseName.slice(0, dot) : baseName;
  let n = 1;
  let candidate;
  do {
    candidate = dir + sep + nameWithoutExt + ' (' + n + ')' + ext;
    n++;
  } while (await window.api.exists(candidate));
  return candidate;
}

async function clipboardPaste(targetDir) {
  if (!_clipboard) { toast('Буфер обмена пуст', 'info'); return; }
  const clip = _clipboard;
  const items = clip.items || [{ path: clip.path, isDir: clip.isDir, name: clip.name }];
  const sep = projectRoot && projectRoot.indexOf('/') !== -1 ? '/' : '\\';
  const dirNorm = targetDir.replace(/[\\/]$/, '') + sep;
  if (clip.op === 'cut' && items.length === 1 && dirNorm + items[0].name === items[0].path) {
    document.querySelectorAll('.tree-item.clipboard-cut').forEach(el => el.classList.remove('clipboard-cut'));
    _clipboard = null;
    return;
  }
  try {
    const createdPaths = [];
    const movedPairs = [];
    if (clip.op === 'copy') {
      for (const it of items) {
        const newPath = await getUniqueDestPath(targetDir, it.name);
        await window.api.copyPath(it.path, newPath);
        createdPaths.push(newPath);
      }
      if (!_isUndoingExplorer && createdPaths.length) pushExplorerUndo({ type: 'create-many', paths: createdPaths });
      toast(items.length > 1 ? `Вставлено копий: ${items.length}` : `Вставлено (копия): ${items[0].name}`, 'success');
    } else {
      document.querySelectorAll('.tree-item.clipboard-cut')
        .forEach(el => el.classList.remove('clipboard-cut'));
      for (const it of items) {
        const newPath = dirNorm + it.name;
        if (newPath !== it.path) {
          await doMove(it.path, newPath);
          movedPairs.push({ from: it.path, to: newPath });
        }
      }
      if (!_isUndoingExplorer && movedPairs.length) pushExplorerUndo({ type: 'move-many', items: movedPairs });
      toast(items.length > 1 ? `Перемещено: ${items.length}` : `Вставлено (перемещение): ${items[0].name}`, 'success');
      _clipboard = null;
    }
    await refreshTree();
    refreshTabs();
  } catch (err) {
    toast(`Ошибка вставки: ${err.message}`, 'error');
  }
}

async function refreshTree(dir, container, depth) {
  if (dir === undefined || dir === null) {
    const tree = $('file-tree');
    tree.innerHTML = '';
    if (!projectRoot) {
      const noProj = document.createElement('div');
      noProj.id = 'no-project';
      noProj.className = 'empty-state';
      noProj.innerHTML = '<p>Нет открытого проекта</p><button class="btn-primary" id="btn-open-folder-empty">Открыть папку</button>';
      tree.append(noProj);
      const b2 = document.getElementById('btn-open-folder-empty');
      if (b2) b2.onclick = openFolder;
      return;
    }
    await refreshTree(projectRoot, tree, 0);
    return;
  }
  let entries;
  try { entries = await window.api.readDir(dir); }
  catch (_) { return; }
  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const e of entries) {
    const item = document.createElement('div');
    item.className = 'tree-item';
    item.dataset.path = e.path;
    item.dataset.isdir = e.isDirectory ? '1' : '0';
    item.style.paddingLeft = (8 + depth * 14) + 'px';
    if (e.isDirectory) {
      const isOpen = expandedDirs.has(e.path);
      const chv = `<svg class="tree-chv${isOpen?' open':''}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="5 2 11 8 5 14"/></svg>`;
      item.innerHTML = `${chv}${getFileIcon(e.name, true)}<span class="name">${e.name}</span>`;
      const children = document.createElement('div');
      children.className = 'tree-children';
      children.style.display = isOpen ? 'block' : 'none';
      container.append(item, children);
      if (isOpen) await refreshTree(e.path, children, depth + 1);
      item.addEventListener('click', async ev => {
        ev.stopPropagation();
        const wasOpen = expandedDirs.has(e.path);
        if (wasOpen) { expandedDirs.delete(e.path); children.style.display = 'none'; children.innerHTML = ''; }
        else {
          expandedDirs.add(e.path); children.style.display = 'block';
          children.innerHTML = '';
          await refreshTree(e.path, children, depth + 1);
        }
        item.querySelector('.tree-chv').classList.toggle('open', !wasOpen);
      });
    } else {
      item.innerHTML = `${getFileIcon(e.name, false)}<span class="name">${e.name}</span>`;
      item.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (ev.ctrlKey || ev.metaKey) {
          if (selectedTreePaths.has(e.path)) selectedTreePaths.delete(e.path);
          else selectedTreePaths.add(e.path);
          refreshTreeSelection();
          return;
        }
        selectedTreePaths.clear();
        openFile(e.path);
      });
      container.append(item);
    }
    makeDraggable(item, e.path, e.isDirectory, e.name);
    item.addEventListener('contextmenu', ev => {
      ev.preventDefault(); ev.stopPropagation();
      showCtxMenu(ev.clientX, ev.clientY, { path: e.path, isDir: e.isDirectory, name: e.name });
    });
  }
}

function refreshTreeSelection() {
  document.querySelectorAll('.tree-item').forEach(function (el) {
    var p = el.dataset.path;
    el.classList.toggle('selected', p === activeFile || selectedTreePaths.has(p));
  });
}

async function checkFolderWritable(folder) {
  const testPath = folder.replace(/[\\/]$/, '') + '\\.sirius_write_test';
  try {
    await window.api.writeFile(testPath, 'ok');
    await window.api.delete(testPath);
    return true;
  } catch (_) {
    return false;
  }
}

async function openFolder() {
  const result = await window.api.openFolderDialog();
  if (!result || !result.filePaths || !result.filePaths[0]) return;
  const folder = result.filePaths[0];
  const writable = await checkFolderWritable(folder);
  if (!writable) {
    toast(
      `Папка "${folder.split(/[\\/]/).pop()}" открыта только для чтения — файлы не сохранятся.`,
      'error', 0,
      {
        label: '⚡ Исправить права (UAC)',
        fn: async () => {
          const t2 = toast('Запрашиваем права администратора…', 'info', 0);
          const ok = await window.api.fixFolderPermissions?.(folder);
          t2.remove();
          if (ok) {
            const ok2 = await checkFolderWritable(folder);
            toast(
              ok2 ? '✓ Права исправлены! Теперь можно создавать файлы.' : 'UAC выполнен, но проверьте права вручную.',
              ok2 ? 'success' : 'info', 5000
            );
          } else {
            toast(
              `Не удалось запустить UAC. Вручную: ПКМ на папку → Свойства → Безопасность → Изменить → Полный доступ`,
              'error', 10000
            );
          }
        }
      }
    );
  }
  projectRoot = folder;
  openFiles = {};
  activeFile = null;
  selectedTreePaths.clear();
  if (editor) editor.setValue('');
  await loadProject(true);
  saveState();
  detectRunCommand();
}

async function openFile(filePath) {
  if (!filePath) return;
  hideWelcome();
  const wasModified = openFiles[filePath]?.modified;
  let readError = null;
  if (!wasModified) {
    const cachedContent = openFiles[filePath]?.content ?? '';
    let content = cachedContent;
    if (window.api?.readFileSafe) {
      const res = await window.api.readFileSafe(filePath);
      if (res.error) readError = res.error;
      else if (res.content != null) content = res.content;
    } else {
      try {
        const diskContent = await window.api.readFile(filePath);
        if (diskContent != null) content = diskContent;
      } catch (e) { readError = e?.message || 'Unknown error'; }
    }
    openFiles[filePath] = { content, savedContent: content, modified: false };
  }
  if (!openFilesOrder || !openFilesOrder.length) openFilesOrder = Object.keys(openFiles);
  if (!openFilesOrder.includes(filePath)) openFilesOrder.push(filePath);
  activeFile = filePath;
  const lang = langOf(filePath);
  const freshContent = (openFiles[filePath]?.content ?? '');
  const fallback = document.getElementById('editor-fallback');
  const editorWrap = document.getElementById('editor-wrap');

  if (editor && monaco) {
    // Monaco доступен — показываем редактор с подсветкой синтаксиса, скрываем fallback
    if (fallback) fallback.classList.remove('visible');
    if (editorWrap) editorWrap.style.display = '';
    const uri = monaco.Uri.file(filePath);
    let model = monaco.editor.getModel(uri);
    if (!model) {
      model = monaco.editor.createModel(freshContent, lang, uri);
    } else {
      if (!wasModified) model.setValue(freshContent);
      monaco.editor.setModelLanguage(model, lang);
    }
    editor.setModel(model);
    editor.layout();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      editor.layout();
      editor.focus();
    }));
  } else {
    // Fallback: только текстовое поле без подсветки
    if (fallback) {
      fallback.value = freshContent;
      fallback.classList.add('visible');
      fallback.oninput = () => {
        if (openFiles[filePath]) {
          openFiles[filePath].content = fallback.value;
          const saved = openFiles[filePath].savedContent ?? '';
          openFiles[filePath].modified = (fallback.value !== saved);
          refreshTabs();
        }
      };
    }
    if (editorWrap) editorWrap.style.display = 'none';
  }
  if (readError) {
    toast(`Ошибка чтения: ${readError}`, 'error', 5000);
  } else if (!freshContent && !wasModified) {
    toast('Файл пуст', 'info', 2000);
  }
  refreshTabs();
  refreshTreeSelection();
  setBreadcrumb(filePath);
  setStatusItem('sb-lang', lang.charAt(0).toUpperCase() + lang.slice(1));
  saveState();
}

async function saveFile() {
  if (!activeFile) return;
  const fallback = document.getElementById('editor-fallback');
  const content = (fallback?.classList.contains('visible') ? fallback?.value : null)
    ?? (editor ? editor.getValue() : null)
    ?? (openFiles[activeFile]?.content || '');
  try {
    await window.api.writeFile(activeFile, content);
    if (openFiles[activeFile]) {
      openFiles[activeFile].content = content;
      openFiles[activeFile].savedContent = content;
      openFiles[activeFile].modified = false;
    }
    refreshTabs();
    toast('Сохранено', 'success', 1500);
    updateGitStatus();
  } catch (e) {
    toast('Ошибка сохранения: ' + e.message, 'error', 6000);
  }
}

function closeTab(filePath) {
  const uri = monaco?.Uri.file(filePath);
  const model = uri ? monaco?.editor?.getModel(uri) : null;
  if (model) model.dispose();
  delete openFiles[filePath];
  const closedIndex = openFilesOrder && openFilesOrder.indexOf(filePath);
  if (openFilesOrder) openFilesOrder = openFilesOrder.filter(p => p !== filePath);
  if (activeFile === filePath) {
    const paths = openFilesOrder && openFilesOrder.length ? openFilesOrder : Object.keys(openFiles);
    const idx = closedIndex >= 0 ? Math.min(closedIndex, paths.length - 1) : 0;
    activeFile = paths.length > 0 ? paths[idx] : null;
    if (activeFile) openFile(activeFile);
    else {
      if (editor) editor.setModel(null);
      showWelcome();
      setBreadcrumb('');
    }
  }
  refreshTabs();
  saveState();
}

function openFileModal(isDir, targetDir = null) {
  const dir = targetDir || projectRoot;
  if (!dir) { toast('Сначала откройте папку проекта', 'info'); return; }
  startInlineCreate(dir, isDir);
}

async function startInlineCreate(parentDir, isDir) {
  if (parentDir !== projectRoot) {
    const parentEl = document.querySelector(`.tree-item[data-path="${CSS.escape(parentDir)}"]`);
    if (parentEl && !expandedDirs.has(parentDir)) {
      parentEl.click();
      await new Promise(r => setTimeout(r, 80));
    }
  }
  const tree = $('file-tree');
  if (!tree) return;
  let container = tree;
  let depth = 0;
  if (parentDir !== projectRoot) {
    const rel = parentDir.replace(projectRoot || '', '');
    depth = rel.split(/[\\/]/).filter(Boolean).length;
    const parentEl = document.querySelector(`.tree-item[data-path="${CSS.escape(parentDir)}"]`);
    if (parentEl) {
      const next = parentEl.nextElementSibling;
      if (next && next.classList.contains('tree-children')) {
        container = next;
      }
    }
  }
  const item = document.createElement('div');
  item.className = 'tree-item tree-item-new';
  item.style.paddingLeft = (8 + depth * 14) + 'px';
  const iconSvg = getFileIcon(isDir ? '.' : 'new.txt', isDir);
  const inp = document.createElement('input');
  inp.className = 'tree-inline-input';
  inp.placeholder = isDir ? 'имя-папки' : 'файл.txt';
  item.innerHTML = iconSvg;
  item.appendChild(inp);
  container.insertBefore(item, container.firstChild);
  inp.focus();
  let committed = false;
  const cancel = () => { if (!committed) item.remove(); };
  const commit = async () => {
    if (committed) return;
    committed = true;
    const name = inp.value.trim();
    item.remove();
    if (!name) return;
    const sep = '\\';
    const fullPath = parentDir.replace(/[\\/]$/, '') + sep + name.replace(/\//g, sep);
    try {
      if (isDir) {
        await window.api.mkdir(fullPath);
        if (!_isUndoingExplorer) pushExplorerUndo({ type: 'create', path: fullPath });
        toast(`Папка создана: ${name}`, 'success');
      } else {
        await window.api.writeFile(fullPath, '');
        if (!_isUndoingExplorer) pushExplorerUndo({ type: 'create', path: fullPath });
        openFiles[fullPath] = { content: '', savedContent: '', modified: false };
        await openFile(fullPath);
        toast(`Файл создан: ${name}`, 'success');
      }
      await refreshTree();
    } catch (e) {
      toast('Ошибка: ' + e.message, 'error', 6000);
    }
  };
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  });
  const outsideClick = (e) => {
    if (!item.contains(e.target) && !$('file-tree').contains(e.target)) {
      cancel();
      document.removeEventListener('mousedown', outsideClick, true);
    }
  };
  document.addEventListener('mousedown', outsideClick, true);
}

let _ctxTarget = null;

function showCtxMenu(x, y, target) {
  _ctxTarget = target;
  const menu = $('ctx-menu');
  const pasteEl = $('ctx-paste');
  if (pasteEl) pasteEl.style.display = _clipboard ? '' : 'none';
  menu.style.display = 'block';
  const vw = window.innerWidth, vh = window.innerHeight;
  const mw = menu.offsetWidth || 200, mh = menu.offsetHeight || 160;
  menu.style.left = (x + mw > vw ? vw - mw - 4 : x) + 'px';
  menu.style.top  = (y + mh > vh ? vh - mh - 4 : y) + 'px';
}

function hideCtxMenu() { $('ctx-menu').style.display = 'none'; _ctxTarget = null; }

async function handleCtxAction(action) {
  const target = _ctxTarget;
  hideCtxMenu();
  if (!target) return;
  const { path: p, isDir, name } = target;
  if (action === 'new-file') {
    const targetDir = isDir ? p : p.replace(/[\\/][^\\/]+$/, '');
    openFileModal(false, targetDir);
  } else if (action === 'new-folder') {
    const targetDir = isDir ? p : p.replace(/[\\/][^\\/]+$/, '');
    openFileModal(true, targetDir);
  } else if (action === 'copy-entry') {
    clipboardCopy(p, isDir, name);
  } else if (action === 'cut-entry') {
    clipboardCut(p, isDir, name);
  } else if (action === 'paste-entry') {
    const targetDir = isDir ? p : p.replace(/[\\/][^\\/]+$/, '');
    await clipboardPaste(targetDir);
  } else if (action === 'rename') {
    startInlineRename(p, name);
  } else if (action === 'delete') {
    const ok = await showConfirm(`Удалить "${name}"? Это действие необратимо.`);
    if (!ok) return;
    try {
      if (openFiles[p]) closeTab(p);
      await window.api.delete(p);
      toast('Удалено', 'success');
      await refreshTree();
    } catch (e) {
      toast('Ошибка удаления: ' + e.message, 'error');
    }
  }
}

function startInlineRename(filePath, currentName) {
  const item = document.querySelector(`.tree-item[data-path="${CSS.escape(filePath)}"]`);
  const nameEl = item ? item.querySelector('.name') : null;
  if (!item || !nameEl) {
    const newName = prompt('Новое имя:', currentName);
    if (!newName || newName === currentName) return;
    doRename(filePath, newName);
    return;
  }

  const existing = item.querySelector('.tree-inline-rename');
  if (existing) {
    existing.focus();
    existing.select();
    return;
  }

  const input = document.createElement('input');
  input.className = 'tree-inline-input tree-inline-rename';
  input.value = currentName;
  input.style.pointerEvents = 'auto';
  input.style.minWidth = '120px';
  input.style.maxWidth = '320px';
  input.style.width = Math.max(120, Math.min(320, currentName.length * 8 + 20)) + 'px';
  nameEl.style.display = 'none';
  nameEl.insertAdjacentElement('afterend', input);
  input.focus();
  input.select();

  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    input.remove();
    nameEl.style.display = '';
  };

  const commit = async () => {
    if (closed) return;
    const newName = input.value.trim();
    cleanup();
    if (!newName || newName === currentName) return;
    await doRename(filePath, newName);
  };
  const cancel = () => cleanup();
  input.onblur = commit;
  input.onkeydown = async (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); await commit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  };
  input.onmousedown = e => e.stopPropagation();
  input.onclick = e => e.stopPropagation();
}

function renameSelectionOrActive() {
  const selected = document.querySelector('.tree-item.selected');
  const focused = document.activeElement ? document.activeElement.closest('.tree-item') : null;
  const item = selected || focused;
  if (!item) {
    toast('Выберите файл или папку в Explorer', 'info');
    return;
  }
  const filePath = item.dataset.path;
  if (!filePath) {
    toast('Не удалось определить путь элемента', 'error');
    return;
  }
  const currentName = filePath.replace(/^.*[\\/]/, '');
  startInlineRename(filePath, currentName);
}

async function doRename(oldPath, newName) {
  const dir = oldPath.replace(/[\\/][^\\/]+$/, '');
  const newPath = dir + '\\' + newName;
  try {
    const wasActive = (activeFile === oldPath);
    if (openFiles[oldPath]) {
      const f = openFiles[oldPath];
      delete openFiles[oldPath];
      openFiles[newPath] = f;
      const oldUri = monaco?.Uri.file(oldPath);
      const oldModel = oldUri ? monaco?.editor?.getModel(oldUri) : null;
      if (oldModel) oldModel.dispose();
    }
    await window.api.rename(oldPath, newPath);
    if (!_isUndoingExplorer) pushExplorerUndo({ type: 'rename', from: oldPath, to: newPath });
    if (wasActive) await openFile(newPath);
    toast('Переименовано', 'success');
    await refreshTree();
    refreshTabs();
  } catch (e) {
    toast('Ошибка переименования: ' + e.message, 'error');
  }
}

async function undoExplorerLastAction() {
  const action = _explorerUndoStack.pop();
  if (!action) { toast('Отменять нечего', 'info', 1200); return; }
  _isUndoingExplorer = true;
  try {
    if (action.type === 'rename' || action.type === 'move') {
      await window.api.rename(action.to, action.from);
    } else if (action.type === 'move-many') {
      for (let i = action.items.length - 1; i >= 0; i--) {
        const m = action.items[i];
        await window.api.rename(m.to, m.from);
      }
    } else if (action.type === 'create') {
      await window.api.delete(action.path);
    } else if (action.type === 'create-many') {
      for (let i = action.paths.length - 1; i >= 0; i--) {
        await window.api.delete(action.paths[i]);
      }
    } else if (action.type === 'delete') {
      async function ensureDir(dir) {
        if (!dir) return;
        if (await window.api.exists(dir)) return;
        const parent = dir.replace(/[\\/][^\\/]+$/, '');
        if (parent && parent !== dir) await ensureDir(parent);
        await window.api.mkdir(dir);
      }
      async function restoreSnapshot(path, snap) {
        if (!snap) return;
        if (snap.kind === 'file') {
          const parent = path.replace(/[\\/][^\\/]+$/, '');
          await ensureDir(parent);
          await window.api.writeFile(path, snap.content || '');
          return;
        }
        await ensureDir(path);
        for (const child of (snap.children || [])) {
          const childPath = path.replace(/[\\/]$/, '') + '\\' + child.name;
          await restoreSnapshot(childPath, child.data);
        }
      }
      for (const s of (action.snapshots || [])) await restoreSnapshot(s.path, s.data);
    }
    await refreshTree();
    refreshTabs();
    if (activeFile && await window.api.exists(activeFile)) await openFile(activeFile);
    toast('Отменено (Explorer)', 'success', 1400);
  } catch (e) {
    toast('Ошибка отмены: ' + e.message, 'error', 3000);
  } finally {
    _isUndoingExplorer = false;
  }
}
