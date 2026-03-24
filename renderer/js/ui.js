/* Sirius IDE — ui.js */
'use strict';

function setBreadcrumb(filePath) {
  const bar = $('breadcrumb-bar');
  if (!filePath) { bar.innerHTML = ''; return; }
  const relative = projectRoot
    ? filePath.replace(projectRoot, '').replace(/^[\\/]/, '')
    : filePath;
  const parts = relative.replace(/\\/g, '/').split('/').filter(Boolean);
  bar.innerHTML = parts.map((p, i) =>
    i === parts.length - 1
      ? `<b>${p}</b>`
      : `<span>${p}</span> <span style="opacity:.4">/</span>`
  ).join(' ');
}

function setStatusItem(id, text) {
  const el = $(id);
  if (!el) return;
  const svg = el.querySelector('svg');
  if (svg) { el.textContent = ''; el.append(svg, document.createTextNode(' ' + text)); }
  else el.textContent = text;
}

function hideWelcome() {
  const wel = document.getElementById('welcome');
  if (wel) wel.hidden = true;
  editor?.layout();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    editor?.layout();
    editor?.focus();
  }));
}

function showWelcome() {
  const wel = document.getElementById('welcome');
  if (wel) wel.hidden = false;
  document.getElementById('editor-fallback')?.classList.remove('visible');
  const wrap = document.getElementById('editor-wrap');
  if (wrap) wrap.style.display = '';
}

function reorderTabs(fromIndex, toIndex) {
  if (fromIndex === toIndex || !openFilesOrder.length) return;
  const path = openFilesOrder[fromIndex];
  openFilesOrder.splice(fromIndex, 1);
  openFilesOrder.splice(toIndex, 0, path);
  refreshTabs();
  if (typeof saveState === 'function') saveState();
}

function refreshTabs() {
  const list = $('tab-list');
  if (!list) return;
  list.innerHTML = '';
  const order = openFilesOrder && openFilesOrder.length ? openFilesOrder : Object.keys(openFiles);
  order.forEach((p, index) => {
    const f = openFiles[p];
    if (!f) return;
    const name = p.split(/[\\/]/).pop();
    const tab = document.createElement('div');
    tab.className = 'tab' + (p === activeFile ? ' active' : '') + (f.modified ? ' modified' : '');
    tab.draggable = true;
    tab.dataset.path = p;
    tab.dataset.index = String(index);
    tab.innerHTML = `<span class="tab-name">${name}</span><span class="tab-dot"></span><button class="tab-close" title="Закрыть">✕</button>`;
    tab.addEventListener('click', ev => { if (!ev.target.closest('.tab-close')) openFile(p); });
    tab.querySelector('.tab-close').addEventListener('click', ev => { ev.stopPropagation(); closeTab(p); });
    tab.addEventListener('dragstart', ev => { ev.dataTransfer.setData('text/plain', String(index)); ev.dataTransfer.effectAllowed = 'move'; tab.classList.add('tab-dragging'); });
    tab.addEventListener('dragend', () => tab.classList.remove('tab-dragging'));
    tab.addEventListener('dragover', ev => { ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; tab.classList.add('tab-drag-over'); });
    tab.addEventListener('dragleave', () => tab.classList.remove('tab-drag-over'));
    tab.addEventListener('drop', ev => {
      ev.preventDefault();
      tab.classList.remove('tab-drag-over');
      const fromIdx = parseInt(ev.dataTransfer.getData('text/plain'), 10);
      if (fromIdx !== index) reorderTabs(fromIdx, index);
    });
    list.append(tab);
  });
}

function initWindowControls() {
  $('btn-min').onclick   = () => window.api.winMinimize();
  $('btn-max').onclick   = () => window.api.winMaximize();
  $('btn-close').onclick = () => window.api.winClose();
  window.api.onMaximized(isMax => {
    const btn = $('btn-max');
    btn.title = isMax ? 'Restore' : 'Maximize';
    btn.querySelector('svg').innerHTML = isMax
      ? '<path d="M2 2h6v6H2zM8 8h6v6H8z" stroke="currentColor" stroke-width="1.2" fill="none"/>'
      : '<rect x="1" y="1" width="8" height="8" stroke="currentColor" stroke-width="1.2" fill="none"/>';
  });
  $('btn-theme').onclick = () => applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
}

function savePanelSizes() {
  try {
    localStorage.setItem('nb_sw', $('sidebar').offsetWidth || '');
    localStorage.setItem('nb_aw', $('ai-panel').offsetWidth || '');
    localStorage.setItem('nb_th', $('term-panel').offsetHeight || '');
  } catch (_) {}
}

function restorePanelSizes() {
  try {
    const sw = localStorage.getItem('nb_sw');
    const aw = localStorage.getItem('nb_aw');
    const th = localStorage.getItem('nb_th');
    if (sw && parseInt(sw) > 80) $('sidebar').style.width = sw + 'px';
    if (aw && parseInt(aw) > 100) $('ai-panel').style.width = aw + 'px';
    if (th && parseInt(th) > 60) $('term-panel').style.height = th + 'px';
  } catch (_) {}
}

function initResizeHandles() {
  setupColResize($('rh-sidebar'), $('sidebar'), null);
  setupColResize($('rh-ai'), null, $('ai-panel'));
  setupRowResize($('term-resize-handle'), $('term-panel'));
}

function setupColResize(handle, leftEl, rightEl) {
  let dragging = false, startX = 0, startW = 0;
  handle.addEventListener('mousedown', e => {
    dragging = true; startX = e.clientX;
    startW = leftEl ? leftEl.offsetWidth : (rightEl ? rightEl.offsetWidth : 0);
    handle.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    if (leftEl) {
      const w = Math.max(100, Math.min(600, startW + dx));
      leftEl.style.width = w + 'px';
    } else if (rightEl) {
      const w = Math.max(150, Math.min(700, startW - dx));
      rightEl.style.width = w + 'px';
    }
  });
  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false; handle.classList.remove('dragging');
    document.body.style.cursor = '';
    savePanelSizes();
  });
}

function setupRowResize(handle, panel) {
  let dragging = false, startY = 0, startH = 0;
  handle.addEventListener('mousedown', e => {
    dragging = true; startY = e.clientY; startH = panel.offsetHeight;
    document.body.style.cursor = 'row-resize'; e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const dy = startY - e.clientY;
    const h = Math.max(80, Math.min(window.innerHeight * 0.7, startH + dy));
    panel.style.height = h + 'px';
  });
  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false; document.body.style.cursor = '';
    savePanelSizes();
    for (const inst of termInstances.values()) inst.fitAddon?.fit();
  });
}

let leftView = 'files';
let aiPanelOpen = true;

function activateView(view) {
  const sidebar  = $('sidebar');
  const aiPanel  = $('ai-panel');

  if (view === 'files' || view === 'search' || view === 'help' || view === 'settings') {
    if (leftView === view && !sidebar.classList.contains('hidden')) {
      sidebar.classList.add('hidden');
      leftView = null;
    } else {
      sidebar.classList.remove('hidden');
      document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
      $(`view-${view}`)?.classList.add('active');
      leftView = view;
      if (view === 'search') setTimeout(() => $('search-input').focus(), 50);
    }
  } else if (view === 'ai') {
    aiPanelOpen = aiPanel.classList.contains('hidden');
    aiPanel.classList.toggle('hidden', !aiPanelOpen);
  } else if (view === 'terminal') {
    toggleTerminal();
    return;
  }

  document.querySelectorAll('.ab-btn').forEach(b => {
    const v = b.dataset.view;
    if (v === 'ai') {
      b.classList.toggle('active', !aiPanel.classList.contains('hidden'));
    } else if (v === 'terminal') {
      b.classList.toggle('active', $('term-panel').classList.contains('open'));
    } else if (v === 'settings' || v === 'files' || v === 'search' || v === 'help') {
      b.classList.toggle('active', v === leftView && !sidebar.classList.contains('hidden'));
    }
  });

  if (view === 'settings') {
    const ta = $('settings-sysprompt');
    if (ta && !ta.value) ta.value = getSystemPrompt();
  }
}

function closeModal(id) { $(id).style.display = 'none'; }

function showConfirm(message) {
  return new Promise(resolve => {
    $('confirm-msg').textContent = message;
    $('modal-confirm-backdrop').style.display = 'flex';
    const ok = $('confirm-ok');
    const cancel = $('confirm-cancel');
    const cleanup = () => { $('modal-confirm-backdrop').style.display = 'none'; };
    ok.onclick = () => { cleanup(); resolve(true); };
    cancel.onclick = () => { cleanup(); resolve(false); };
  });
}

function initShortcuts() {
  document.addEventListener('keydown', e => {
    const ctrl = e.ctrlKey || e.metaKey;
    const inTree = e.target.closest('#file-tree') || e.target.closest('#sidebar');
    const renameInlineOpen = !!document.querySelector('.tree-inline-rename');
    if (inTree && projectRoot && e.key === 'F2' && !renameInlineOpen && !e.target.closest('input, textarea')) {
      e.preventDefault();
      if (typeof renameSelectionOrActive === 'function') renameSelectionOrActive();
      return;
    }
    if (inTree && projectRoot && ctrl && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      if (typeof copySelectionToClipboard === 'function') copySelectionToClipboard();
      return;
    }
    if (inTree && projectRoot && ctrl && e.key.toLowerCase() === 'x') {
      e.preventDefault();
      if (typeof cutSelectionToClipboard === 'function') cutSelectionToClipboard();
      return;
    }
    if (inTree && projectRoot && ctrl && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      if (typeof getPasteTargetDir === 'function' && typeof clipboardPaste === 'function') {
        const dir = getPasteTargetDir();
        if (dir) clipboardPaste(dir);
      }
      return;
    }
    if (inTree && projectRoot && ctrl && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (typeof undoExplorerLastAction === 'function') undoExplorerLastAction();
      return;
    }
    if (inTree && projectRoot && e.key === 'Delete') {
      e.preventDefault();
      if (typeof deleteSelectionOrActive === 'function') deleteSelectionOrActive();
      return;
    }
    if (ctrl && e.key === 'b') { e.preventDefault(); activateView(leftView === 'files' ? 'search' : 'files'); }
    if (ctrl && e.key === '`') { e.preventDefault(); activateView('terminal'); }
    if (ctrl && e.shiftKey && e.key.toLowerCase() === 'a') { e.preventDefault(); activateView('ai'); }
    if (ctrl && e.shiftKey && e.key.toLowerCase() === 'n') { e.preventDefault(); window.api.newWindow?.(); }
    if (ctrl && e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); saveAllFiles(); }
    if (ctrl && e.key === 'n' && !e.shiftKey) { e.preventDefault(); openFileModal(false); }
    if (ctrl && e.key === 's' && !e.shiftKey) { e.preventDefault(); saveFile(); }
    if (ctrl && e.key === 'w') { e.preventDefault(); if (activeFile) closeTab(activeFile); }
    if (ctrl && e.key === 'o') { e.preventDefault(); openFolder(); }
    if (ctrl && e.key === 'f' && !e.target.closest('.monaco-editor')) {
      e.preventDefault();
      if (editor) { editor.focus(); editor.getAction('actions.find').run(); }
    }
    if (ctrl && e.key === 'h' && !e.target.closest('.monaco-editor')) {
      e.preventDefault();
      if (editor) { editor.focus(); editor.getAction('editor.action.startFindReplaceAction').run(); }
    }
    if (ctrl && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      saveState();
      window.location.reload();
    }
    if (e.key === 'F5') { e.preventDefault(); runProject(); }
  });
}

const MENUS = {
  file: [
    { label: 'Открыть папку…',  kbd: 'Ctrl+O', action: 'open-folder' },
    { label: 'Новый файл',       kbd: 'Ctrl+N', action: 'new-file' },
    { label: 'Новая папка',      kbd: '',       action: 'new-folder' },
    { sep: true },
    { label: 'Сохранить',        kbd: 'Ctrl+S', action: 'save' },
    { label: 'Сохранить всё',    kbd: 'Ctrl+Shift+S', action: 'save-all' },
    { sep: true },
    { label: 'Закрыть вкладку',  kbd: 'Ctrl+W', action: 'close-tab' },
    { sep: true },
    { label: 'Новое окно',       kbd: 'Ctrl+Shift+N', action: 'new-window' },
  ],
  edit: [
    { label: 'Отменить',         kbd: 'Ctrl+Z',  action: 'undo' },
    { label: 'Повторить',        kbd: 'Ctrl+Y',  action: 'redo' },
    { sep: true },
    { label: 'Вырезать',         kbd: 'Ctrl+X',  action: 'cut' },
    { label: 'Копировать',       kbd: 'Ctrl+C',  action: 'copy' },
    { label: 'Вставить',         kbd: 'Ctrl+V',  action: 'paste' },
    { sep: true },
    { label: 'Найти в файле',    kbd: 'Ctrl+F',  action: 'find' },
    { label: 'Заменить',         kbd: 'Ctrl+H',  action: 'replace' },
  ],
  view: [
    { label: 'Проводник',        kbd: 'Ctrl+B',       action: 'view-files' },
    { label: 'Поиск',            kbd: 'Ctrl+Shift+F', action: 'view-search' },
    { label: 'Sirius AI',        kbd: 'Ctrl+Shift+A', action: 'view-ai' },
    { label: 'Документация',     kbd: '',             action: 'view-help' },
    { sep: true },
    { label: 'Терминал',         kbd: 'Ctrl+`',       action: 'view-terminal' },
    { sep: true },
    { label: 'Тёмная тема',      kbd: '',             action: 'theme-dark' },
    { label: 'Светлая тема',     kbd: '',             action: 'theme-light' },
  ],
  run: [
    { label: 'Запустить проект', kbd: 'F5',           action: 'run' },
    { label: 'Открыть терминал', kbd: 'Ctrl+`',       action: 'view-terminal' },
  ],
  window: [
    { label: 'Новое окно',       kbd: 'Ctrl+Shift+N', action: 'new-window' },
    { sep: true },
    { label: 'Свернуть',         kbd: '',             action: 'win-minimize' },
    { label: 'Развернуть',       kbd: '',             action: 'win-maximize' },
    { sep: true },
    { label: 'Закрыть',          kbd: 'Alt+F4',       action: 'win-close' },
  ],
};

let _openMenu = null;

function initMenuBar() {
  document.querySelectorAll('.mb-item').forEach(item => {
    item.addEventListener('click', e => {
      e.stopPropagation();
      const menu = item.dataset.menu;
      if (_openMenu === menu) { closeMenuBar(); return; }
      openMenuBar(menu, item);
    });
    item.addEventListener('mouseenter', () => {
      if (_openMenu && _openMenu !== item.dataset.menu) openMenuBar(item.dataset.menu, item);
    });
  });
  document.addEventListener('click', closeMenuBar);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenuBar(); });
}

function openMenuBar(menu, anchor) {
  _openMenu = menu;
  document.querySelectorAll('.mb-item').forEach(b => b.classList.toggle('open', b.dataset.menu === menu));
  const drop = $('mb-dropdown');
  const items = MENUS[menu] || [];
  drop.innerHTML = '';
  items.forEach(it => {
    if (it.sep) {
      const sep = document.createElement('div'); sep.className = 'mb-sep';
      drop.appendChild(sep); return;
    }
    const el = document.createElement('div');
    el.className = 'mb-drop-item';
    el.innerHTML = `<span>${it.label}</span>${it.kbd ? `<span class="kbd">${it.kbd}</span>` : ''}`;
    el.addEventListener('click', e => {
      e.stopPropagation();
      closeMenuBar();
      handleMenuAction(it.action);
    });
    drop.appendChild(el);
  });
  const rect = anchor.getBoundingClientRect();
  drop.style.display = 'block';
  const w = drop.offsetWidth;
  const left = Math.min(rect.left, window.innerWidth - w - 4);
  drop.style.left = left + 'px';
  drop.style.top  = rect.bottom + 2 + 'px';
}

function closeMenuBar() {
  _openMenu = null;
  $('mb-dropdown').style.display = 'none';
  document.querySelectorAll('.mb-item').forEach(b => b.classList.remove('open'));
}

function handleMenuAction(action) {
  switch (action) {
    case 'open-folder':    openFolder(); break;
    case 'new-file':       openFileModal(false); break;
    case 'new-folder':     openFileModal(true); break;
    case 'save':           saveFile(); break;
    case 'save-all':       saveAllFiles(); break;
    case 'close-tab':      if (activeFile) closeTab(activeFile); break;
    case 'new-window':     window.api.newWindow?.(); break;
    case 'undo':           editor?.trigger('menu', 'undo'); break;
    case 'redo':           editor?.trigger('menu', 'redo'); break;
    case 'cut':            editor?.trigger('menu', 'editor.action.clipboardCutAction'); break;
    case 'copy':           editor?.trigger('menu', 'editor.action.clipboardCopyAction'); break;
    case 'paste':          editor?.trigger('menu', 'editor.action.clipboardPasteAction'); break;
    case 'find':           if (editor) { editor.focus(); editor.getAction('actions.find').run(); } break;
    case 'replace':        if (editor) { editor.focus(); editor.getAction('editor.action.startFindReplaceAction').run(); } break;
    case 'view-files':     activateView('files'); break;
    case 'view-search':    activateView('search'); break;
    case 'view-ai':        activateView('ai'); break;
    case 'view-help':      activateView('help'); break;
    case 'view-settings':  activateView('settings'); break;
    case 'view-terminal':  activateView('terminal'); break;
    case 'theme-dark':     applyTheme('dark'); break;
    case 'theme-light':    applyTheme('light'); break;
    case 'run':            runProject(); break;
    case 'win-minimize':   window.api.winMinimize(); break;
    case 'win-maximize':   window.api.winMaximize(); break;
    case 'win-close':      window.api.winClose(); break;
  }
}

async function saveAllFiles() {
  const paths = Object.keys(openFiles).filter(p => openFiles[p]?.modified);
  for (const p of paths) {
    const content = activeFile === p && editor ? editor.getValue() : openFiles[p].content;
    try {
      await window.api.writeFile(p, content);
      if (openFiles[p]) { openFiles[p].content = content; openFiles[p].modified = false; }
    } catch (e) { toast('Ошибка сохранения ' + p.split(/[\\/]/).pop() + ': ' + e.message, 'error'); }
  }
  refreshTabs();
  if (paths.length) toast(`Сохранено файлов: ${paths.length}`, 'success', 2000);
}
