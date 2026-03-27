/* Sirius IDE — ui.js */
'use strict';

function setBreadcrumb(filePath) {
  const bar = $('breadcrumb-bar');
  if (!filePath) { bar.textContent = ''; return; }
  const relative = projectRoot
    ? filePath.replace(projectRoot, '').replace(/^[\\/]/, '')
    : filePath;
  const parts = relative.replace(/\\/g, '/').split('/').filter(Boolean);
  bar.textContent = '';
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (i === parts.length - 1) {
      const b = document.createElement('b');
      b.textContent = String(p);
      bar.append(b);
    } else {
      const span = document.createElement('span');
      span.textContent = String(p);
      bar.append(span);
      const sep = document.createElement('span');
      sep.className = 'bc-sep';
      sep.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>';
      bar.append(sep);
    }
  }
}

const I18N = {
  ru: {
    'menu.file': 'Файл',
    'menu.edit': 'Правка',
    'menu.view': 'Вид',
    'menu.run': 'Запуск',
    'menu.window': 'Окно',
    'tab.files.title': 'Explorer (Ctrl+B)',
    'tab.search.title': 'Search (Ctrl+F)',
    'tab.help.title': 'Документация',
    'tab.settings.title': 'Settings',
    'tab.security.title': 'Security / AI Journal',
    'panel.explorer': 'Explorer',
    'panel.docs': 'Документация',
    'panel.search': 'Search',
    'panel.settings': 'Настройки',
    'panel.security': 'Безопасность / AI Журнал',
    'settings.language.label': 'Язык интерфейса',
    'settings.language.hint': 'Переключает подписи вкладок, панелей и меню.',
    'menuItem.openFolder': 'Открыть папку…',
    'menuItem.newFile': 'Новый файл',
    'menuItem.newFolder': 'Новая папка',
    'menuItem.save': 'Сохранить',
    'menuItem.saveAll': 'Сохранить всё',
    'menuItem.closeTab': 'Закрыть вкладку',
    'menuItem.newWindow': 'Новое окно',
    'menuItem.undo': 'Отменить',
    'menuItem.redo': 'Повторить',
    'menuItem.cut': 'Вырезать',
    'menuItem.copy': 'Копировать',
    'menuItem.paste': 'Вставить',
    'menuItem.find': 'Найти в файле',
    'menuItem.replace': 'Заменить',
    'menuItem.explorer': 'Проводник',
    'menuItem.search': 'Поиск',
    'menuItem.ai': 'Sirius AI',
    'menuItem.docs': 'Документация',
    'menuItem.terminal': 'Терминал',
    'menuItem.themeDark': 'Тёмная тема',
    'menuItem.themeLight': 'Светлая тема',
    'menuItem.runProject': 'Запустить проект',
    'menuItem.minimize': 'Свернуть',
    'menuItem.maximize': 'Развернуть',
    'menuItem.close': 'Закрыть',
  },
  en: {
    'menu.file': 'File',
    'menu.edit': 'Edit',
    'menu.view': 'View',
    'menu.run': 'Run',
    'menu.window': 'Window',
    'tab.files.title': 'Explorer (Ctrl+B)',
    'tab.search.title': 'Search (Ctrl+F)',
    'tab.help.title': 'Documentation',
    'tab.settings.title': 'Settings',
    'tab.security.title': 'Security / AI Journal',
    'panel.explorer': 'Explorer',
    'panel.docs': 'Documentation',
    'panel.search': 'Search',
    'panel.settings': 'Settings',
    'panel.security': 'Security / AI Journal',
    'settings.language.label': 'Interface language',
    'settings.language.hint': 'Switches tab, panel, and menu labels.',
    'menuItem.openFolder': 'Open Folder…',
    'menuItem.newFile': 'New File',
    'menuItem.newFolder': 'New Folder',
    'menuItem.save': 'Save',
    'menuItem.saveAll': 'Save All',
    'menuItem.closeTab': 'Close Tab',
    'menuItem.newWindow': 'New Window',
    'menuItem.undo': 'Undo',
    'menuItem.redo': 'Redo',
    'menuItem.cut': 'Cut',
    'menuItem.copy': 'Copy',
    'menuItem.paste': 'Paste',
    'menuItem.find': 'Find in File',
    'menuItem.replace': 'Replace',
    'menuItem.explorer': 'Explorer',
    'menuItem.search': 'Search',
    'menuItem.ai': 'Sirius AI',
    'menuItem.docs': 'Documentation',
    'menuItem.terminal': 'Terminal',
    'menuItem.themeDark': 'Dark Theme',
    'menuItem.themeLight': 'Light Theme',
    'menuItem.runProject': 'Run Project',
    'menuItem.minimize': 'Minimize',
    'menuItem.maximize': 'Maximize',
    'menuItem.close': 'Close',
  }
};

function tr(key) {
  const lang = I18N[currentLang] ? currentLang : 'ru';
  return I18N[lang][key] || key;
}

function rebuildMenus() {
  MENUS = {
    file: [
      { label: tr('menuItem.openFolder'),  kbd: 'Ctrl+O', action: 'open-folder' },
      { label: tr('menuItem.newFile'),     kbd: 'Ctrl+N', action: 'new-file' },
      { label: tr('menuItem.newFolder'),   kbd: '',       action: 'new-folder' },
      { sep: true },
      { label: tr('menuItem.save'),        kbd: 'Ctrl+S', action: 'save' },
      { label: tr('menuItem.saveAll'),     kbd: 'Ctrl+Shift+S', action: 'save-all' },
      { sep: true },
      { label: tr('menuItem.closeTab'),    kbd: 'Ctrl+W', action: 'close-tab' },
    ],
    edit: [
      { label: tr('menuItem.undo'),        kbd: 'Ctrl+Z',  action: 'undo' },
      { label: tr('menuItem.redo'),        kbd: 'Ctrl+Y',  action: 'redo' },
      { sep: true },
      { label: tr('menuItem.cut'),         kbd: 'Ctrl+X',  action: 'cut' },
      { label: tr('menuItem.copy'),        kbd: 'Ctrl+C',  action: 'copy' },
      { label: tr('menuItem.paste'),       kbd: 'Ctrl+V',  action: 'paste' },
      { sep: true },
      { label: tr('menuItem.find'),        kbd: 'Ctrl+F',  action: 'find' },
      { label: tr('menuItem.replace'),     kbd: 'Ctrl+H',  action: 'replace' },
    ],
    view: [
      { label: tr('menuItem.explorer'),    kbd: 'Ctrl+B',       action: 'view-files' },
      { label: tr('menuItem.search'),      kbd: 'Ctrl+Shift+F', action: 'view-search' },
      { label: tr('menuItem.ai'),          kbd: 'Ctrl+Shift+A', action: 'view-ai' },
      { label: tr('menuItem.docs'),        kbd: '',             action: 'view-help' },
      { sep: true },
      { label: tr('menuItem.terminal'),    kbd: 'Ctrl+`',       action: 'view-terminal' },
      { sep: true },
      { label: tr('menuItem.themeDark'),   kbd: '',             action: 'theme-dark' },
      { label: tr('menuItem.themeLight'),  kbd: '',             action: 'theme-light' },
    ],
    run: [
      { label: tr('menuItem.runProject'),  kbd: 'F5',           action: 'run' },
      { label: tr('menuItem.terminal'),    kbd: 'Ctrl+`',       action: 'view-terminal' },
    ],
    window: [
      { label: tr('menuItem.minimize'),    kbd: '',             action: 'win-minimize' },
      { label: tr('menuItem.maximize'),    kbd: '',             action: 'win-maximize' },
      { sep: true },
      { label: tr('menuItem.close'),       kbd: 'Alt+F4',       action: 'win-close' },
    ],
  };
}

function applyUILanguage(lang) {
  if (typeof setCurrentLang === 'function') setCurrentLang((lang === 'en') ? 'en' : 'ru');
  else currentLang = (lang === 'en') ? 'en' : 'ru';
  localStorage.setItem('nb_lang', currentLang);
  document.documentElement.setAttribute('lang', currentLang === 'en' ? 'en' : 'ru');

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (!key) return;
    el.textContent = tr(key);
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    if (!key) return;
    el.title = tr(key);
  });

  rebuildMenus();
  if (_openMenu) {
    const anchor = document.querySelector(`.mb-item[data-menu="${_openMenu}"]`);
    if (anchor) openMenuBar(_openMenu, anchor);
  }
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
  if (activeUtilityTab === 'settings' || activeUtilityTab === 'security') {
    const utilityTab = document.createElement('div');
    const isSettings = activeUtilityTab === 'settings';
    utilityTab.className = 'tab utility-tab active';
    const name = isSettings ? 'Settings' : 'Security / AI Journal';
    const nameEl = document.createElement('span');
    nameEl.className = 'tab-name';
    nameEl.textContent = name;
    const dotEl = document.createElement('span');
    dotEl.className = 'tab-dot';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-close';
    closeBtn.title = 'Закрыть';
    closeBtn.textContent = '✕';
    utilityTab.append(nameEl, dotEl, closeBtn);
    utilityTab.addEventListener('click', ev => {
      if (ev.target.closest('.tab-close')) return;
      if (isSettings) openSettingsTab();
      else openSecurityTab();
    });
    utilityTab.addEventListener('mousedown', ev => {
      if (ev.button === 1) ev.preventDefault();
    });
    utilityTab.addEventListener('auxclick', ev => {
      if (ev.button === 1) {
        ev.preventDefault();
        if (isSettings) closeSettingsTab();
        else closeSecurityTab();
      }
    });
    closeBtn.addEventListener('click', ev => {
      ev.stopPropagation();
      if (isSettings) closeSettingsTab();
      else closeSecurityTab();
    });
    list.append(utilityTab);
  }
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
    const nameEl = document.createElement('span');
    nameEl.className = 'tab-name';
    nameEl.textContent = name;
    const dotEl = document.createElement('span');
    dotEl.className = 'tab-dot';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-close';
    closeBtn.title = 'Закрыть';
    closeBtn.textContent = '✕';
    tab.append(nameEl, dotEl, closeBtn);
    tab.addEventListener('click', ev => {
      if (ev.target.closest('.tab-close')) return;
      if (ev.altKey && typeof window.isEditorSplitEnabled === 'function' && window.isEditorSplitEnabled()) {
        if (typeof window.setSecondaryEditorFile === 'function' && window.setSecondaryEditorFile(p)) return;
      }
      if (isSettingsScreenOpen()) closeSettingsTab();
      if (isSecurityScreenOpen()) closeSecurityTab();
      openFile(p);
    });
    tab.addEventListener('mousedown', ev => {
      if (ev.button === 1) ev.preventDefault();
    });
    tab.addEventListener('auxclick', ev => {
      if (ev.button === 1) {
        ev.preventDefault();
        closeTab(p);
      }
    });
    closeBtn.addEventListener('click', ev => { ev.stopPropagation(); closeTab(p); });
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
let activeUtilityTab = null; // 'settings' | 'security'

function isSettingsScreenOpen() {
  const el = $('settings-screen');
  return !!(el && !el.hidden);
}

function openSettingsScreen() {
  const el = $('settings-screen');
  if (!el) return;
  el.hidden = false;
  document.dispatchEvent(new CustomEvent('sirius:settings-open'));
}

function closeSettingsScreen() {
  const el = $('settings-screen');
  if (!el) return;
  el.hidden = true;
}

function openSettingsTab() {
  activeUtilityTab = 'settings';
  openSettingsScreen();
  refreshTabs();
}

function closeSettingsTab() {
  closeSettingsScreen();
  if (activeUtilityTab === 'settings') activeUtilityTab = null;
  refreshTabs();
}

function isSecurityScreenOpen() {
  const el = $('security-screen');
  return !!(el && !el.hidden);
}

function openSecurityScreen() {
  const el = $('security-screen');
  if (!el) return;
  el.hidden = false;
}

function closeSecurityScreen() {
  const el = $('security-screen');
  if (!el) return;
  el.hidden = true;
}

function renderSecurityJournal() {
  const body = $('security-journal-body');
  if (!body) return;
  let items = [];
  try {
    items = (typeof window.getAiOperationJournal === 'function')
      ? window.getAiOperationJournal()
      : [];
  } catch (_) { items = []; }
  if (!Array.isArray(items) || !items.length) {
    body.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'security-journal-empty';
    empty.textContent = 'Журнал пока пуст.';
    body.append(empty);
    return;
  }
  body.innerHTML = '';
  const table = document.createElement('table');
  table.className = 'security-journal-table';
  const thead = document.createElement('thead');
  const headTr = document.createElement('tr');
  ['Time', 'Cmd', 'Path', 'Status', 'Reason'].forEach((h) => {
    const th = document.createElement('th');
    th.textContent = h;
    headTr.append(th);
  });
  thead.append(headTr);
  const tbody = document.createElement('tbody');
  items.slice().reverse().forEach((it) => {
    const tr = document.createElement('tr');
    const ts = String(it.ts || '').replace('T', ' ').replace('Z', '');
    const cmd = String(it.cmd || '');
    const arg = String(it.arg || '');
    const status = it.ok ? 'OK' : 'BLOCKED/ERR';
    const reason = String(it.reason || it.error || '');
    [ts, cmd, arg, status, reason].forEach((v, idx) => {
      const td = document.createElement('td');
      td.textContent = v;
      if (idx === 2 || idx === 4) td.title = v;
      tr.append(td);
    });
    tbody.append(tr);
  });
  table.append(thead, tbody);
  body.append(table);
}

function openSecurityTab() {
  activeUtilityTab = 'security';
  openSecurityScreen();
  renderSecurityJournal();
  refreshTabs();
}

function closeSecurityTab() {
  closeSecurityScreen();
  if (activeUtilityTab === 'security') activeUtilityTab = null;
  refreshTabs();
}

function isHelpScreenOpen() {
  const el = $('help-screen');
  return !!(el && !el.hidden);
}

function openHelpScreen() {
  const el = $('help-screen');
  if (!el) return;
  el.hidden = false;
}

function closeHelpScreen() {
  const el = $('help-screen');
  if (!el) return;
  el.hidden = true;
}

function activateView(view) {
  const sidebar  = $('sidebar');
  const aiPanel  = $('ai-panel');

  if (view !== 'settings') closeSettingsTab();
  if (view !== 'security') closeSecurityTab();
  if (view !== 'help') closeHelpScreen();

  if (view === 'settings') {
    if (isSettingsScreenOpen()) closeSettingsTab();
    else openSettingsTab();
  } else if (view === 'security') {
    if (isSecurityScreenOpen()) closeSecurityTab();
    else openSecurityTab();
  } else if (view === 'help') {
    if (isHelpScreenOpen()) {
      closeHelpScreen();
    } else {
      openHelpScreen();
    }
  } else
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
    } else if (v === 'settings') {
      b.classList.toggle('active', isSettingsScreenOpen());
    } else if (v === 'security') {
      b.classList.toggle('active', isSecurityScreenOpen());
    } else if (v === 'help') {
      b.classList.toggle('active', isHelpScreenOpen());
    } else if (v === 'files' || v === 'search' || v === 'help') {
      b.classList.toggle('active', v === leftView && !sidebar.classList.contains('hidden'));
    }
  });

  if (view === 'settings') {
    const ta = $('settings-sysprompt');
    if (isSettingsScreenOpen() && ta && !ta.value) ta.value = getSystemPrompt();
  } else if (view === 'security') {
    renderSecurityJournal();
  }
}

function closeModal(id) { $(id).style.display = 'none'; }

function showConfirm(message, opts) {
  opts = opts || {};
  return new Promise(resolve => {
    const titleEl = $('confirm-title');
    if (titleEl) titleEl.textContent = opts.title || 'Подтверждение';
    $('confirm-msg').textContent = message;
    $('modal-confirm-backdrop').style.display = 'flex';
    const ok = $('confirm-ok');
    const cancel = $('confirm-cancel');
    ok.textContent = opts.okText || 'Подтвердить';
    cancel.textContent = opts.cancelText || 'Отмена';
    ok.style.background = opts.danger ? 'var(--c-danger)' : 'var(--c-accent)';
    const cleanup = () => { $('modal-confirm-backdrop').style.display = 'none'; };
    ok.onclick = () => { cleanup(); resolve(true); };
    cancel.onclick = () => { cleanup(); resolve(false); };
  });
}

function initShortcuts() {
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isHelpScreenOpen()) {
      e.preventDefault();
      closeHelpScreen();
      document.querySelectorAll('.ab-btn').forEach(b => {
        if (b.dataset.view === 'help') b.classList.remove('active');
      });
      return;
    }
    if (e.key === 'Escape' && isSettingsScreenOpen()) {
      e.preventDefault();
      closeSettingsTab();
      document.querySelectorAll('.ab-btn').forEach(b => {
        if (b.dataset.view === 'settings') b.classList.remove('active');
      });
      return;
    }
    if (e.key === 'Escape' && isSecurityScreenOpen()) {
      e.preventDefault();
      closeSecurityTab();
      document.querySelectorAll('.ab-btn').forEach(b => {
        if (b.dataset.view === 'security') b.classList.remove('active');
      });
      return;
    }
    const ctrl = e.ctrlKey || e.metaKey;
    // Zoom hotkeys: support main keyboard, shifted '+', and numpad.
    if (ctrl && (e.code === 'Equal' || e.code === 'NumpadAdd' || e.key === '+')) {
      e.preventDefault();
      window.api.zoomIn?.();
      return;
    }
    if (ctrl && (e.code === 'Minus' || e.code === 'NumpadSubtract' || e.key === '-')) {
      e.preventDefault();
      window.api.zoomOut?.();
      return;
    }
    if (ctrl && (e.code === 'Digit0' || e.code === 'Numpad0' || e.key === '0')) {
      e.preventDefault();
      window.api.zoomReset?.();
      return;
    }
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
    if (e.altKey && e.key === '\\') {
      e.preventDefault();
      if (typeof window.toggleEditorSplit === 'function') window.toggleEditorSplit();
    }
    if (ctrl && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      saveState();
      window.location.reload();
    }
    if (e.key === 'F5') { e.preventDefault(); runProject(); }
  });
}

let MENUS = {};
rebuildMenus();

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
    } catch (e) {
      const msg = String(e?.message || e || '').toLowerCase();
      if (msg.includes('eperm') || msg.includes('eacces') || msg.includes('нет прав')) {
        toast('Часть файлов не сохранена: у папки ограничен доступ.', 'error', 4500);
        if (typeof handleWritePermissionError === 'function') handleWritePermissionError(e, p, 'Часть файлов не сохранена: у папки ограничен доступ.');
      } else {
        toast('Ошибка сохранения ' + p.split(/[\\/]/).pop() + ': ' + e.message, 'error');
      }
    }
  }
  refreshTabs();
  if (paths.length) toast(`Сохранено файлов: ${paths.length}`, 'success', 2000);
}
