/* Sirius IDE — state.js */
'use strict';

// Shared state mirrors centralized store for backward compatibility.
let projectRoot = window.appStore?.get('projectRoot') ?? null;
let openFiles   = window.appStore?.get('openFiles') ?? {};
let openFilesOrder = window.appStore?.get('openFilesOrder') ?? []; // порядок вкладок для отображения и перетаскивания
let activeFile  = window.appStore?.get('activeFile') ?? null;
let editor      = null;
let monaco      = null;
let aiDecoIds   = [];
let _dragSrc         = null;
let _dragCurrentOver = null;
let _clipboard = null;
const expandedDirs = new Set();

const DEFAULT_SYSPROMPT =
  'Ты — экспертный ИИ-ассистент в среде Sirius IDE: помогаешь писать и рефакторить код, отвечаешь на вопросы по проекту. ' +
  'Перед ответом выполняй самопроверку: не делай разрушительных действий без явного запроса пользователя, ' +
  'не очищай и не удаляй содержимое файлов без прямого подтверждения. Отвечай на языке пользователя. Будь точным и действуй по инструкциям ниже.';

function getSystemPrompt() {
  return localStorage.getItem('nb_sysprompt') || DEFAULT_SYSPROMPT;
}

let currentTheme = window.appStore?.get('currentTheme') || localStorage.getItem('nb_theme') || 'dark';
let currentLang = window.appStore?.get('currentLang') || localStorage.getItem('nb_lang') || 'ru';
let _themeAnimTimer = null;

function setProjectRoot(v) {
  if (window.appStore) window.appStore.set('projectRoot', v);
  projectRoot = v;
}
function replaceOpenFiles(v) {
  const next = v || {};
  if (window.appStore) window.appStore.set('openFiles', next);
  openFiles = next;
}
function setOpenFilesOrder(v) {
  const next = Array.isArray(v) ? v : [];
  if (window.appStore) window.appStore.set('openFilesOrder', next);
  openFilesOrder = next;
}
function setActiveFile(v) {
  if (window.appStore) window.appStore.set('activeFile', v);
  activeFile = v;
}
function setCurrentTheme(v) {
  if (window.appStore) window.appStore.set('currentTheme', v);
  currentTheme = v;
}
function setCurrentLang(v) {
  if (window.appStore) window.appStore.set('currentLang', v);
  currentLang = v;
}

if (window.appStore?.subscribe) {
  window.appStore.subscribe(function (_k, _v, s) {
    projectRoot = s.projectRoot;
    openFiles = s.openFiles;
    openFilesOrder = s.openFilesOrder;
    activeFile = s.activeFile;
    currentTheme = s.currentTheme;
    currentLang = s.currentLang;
  });
}

function saveState() {
  try {
    const fileMeta = {};
    const order = openFilesOrder && openFilesOrder.length ? openFilesOrder : Object.keys(openFiles);
    for (const p of order) {
      if (!openFiles[p]) continue;
      const content = (p === activeFile && editor) ? editor.getValue() : (openFiles[p].content || '');
      fileMeta[p] = content;
    }
    const root   = projectRoot || '';
    const active = activeFile  || '';
    const payload = JSON.stringify({ root, active, files: fileMeta });
    localStorage.setItem('nb_root', root);
    localStorage.setItem('nb_files', JSON.stringify(fileMeta));
    localStorage.setItem('nb_active', active);
    try {
      if (window.api?.storeRendererState) window.api.storeRendererState(payload).catch(() => {});
      if (root && window.api?.saveProjectState) window.api.saveProjectState(payload).catch(() => {});
    } catch (_) {}
  } catch (_) {}
}

async function restoreState() {
  let root = '', filesJson = '{}', activePath = '';
  try {
    const mainState = await window.api?.getRendererState?.();
    if (mainState?.root) {
      root = mainState.root;
      filesJson = mainState.files ? JSON.stringify(mainState.files) : '{}';
      activePath = mainState.active || '';
    }
  } catch (_) {}
  if (!root) {
    root = localStorage.getItem('nb_root') || '';
    filesJson = localStorage.getItem('nb_files') || '{}';
    activePath = localStorage.getItem('nb_active') || '';
  }
  if (!root) {
    try {
      const backup = await window.api?.loadProjectState?.();
      if (backup) {
        const d = JSON.parse(backup);
        root = d.root || ''; filesJson = d.files ? JSON.stringify(d.files) : '{}'; activePath = d.active || '';
      }
    } catch (_) {}
  }
  if (!root) return;

  try {
    const meta = JSON.parse(filesJson);
    replaceOpenFiles({});
    setOpenFilesOrder(Object.keys(meta));
    for (const [p, content] of Object.entries(meta)) {
      openFiles[p] = { content: String(content), savedContent: String(content), modified: false };
    }
  } catch (_) {}

  setProjectRoot(root);
  try { hideWelcome(); } catch (_) {}
  // Сначала зарегистрировать корень в main (addAllowedRoot), иначе refreshTree/openFile упадут по validatePath
  await window.api.watchDir(root).catch(() => {});
  try { await refreshTree(); } catch (_) {}

  if (activePath) {
    try {
      await openFile(activePath);
    } catch (_) {
      if (openFiles[activePath]?.content != null && editor && monaco) {
        try {
          const lang = langOf(activePath);
          const uri  = monaco.Uri.file(activePath);
          let model  = monaco.editor.getModel(uri);
          const text = String(openFiles[activePath].content);
          if (!model) model = monaco.editor.createModel(text, lang, uri);
          else {
            model.setValue(text);
            monaco.editor.setModelLanguage(model, lang);
          }
          editor.setModel(model);
          setActiveFile(activePath);
          editor.layout();
          setBreadcrumb(activePath);
          setStatusItem('sb-lang', lang.charAt(0).toUpperCase() + lang.slice(1));
          // Показать Monaco, скрыть fallback при восстановлении через catch
          document.getElementById('editor-fallback')?.classList.remove('visible');
          const wrap = document.getElementById('editor-wrap');
          if (wrap) wrap.style.display = '';
        } catch (_2) {}
      }
    }
  }

  try { refreshTabs(); } catch (_) {}
  try { updateGitStatus(); } catch (_) {}
  try { detectRunCommand(); } catch (_) {}

  // Гарантированно скрыть приветствие и показать область редактора после восстановления
  const wel = document.getElementById('welcome');
  if (wel) wel.hidden = true;
  const wrap = document.getElementById('editor-wrap');
  if (wrap) wrap.style.display = '';
  document.getElementById('editor-fallback')?.classList.remove('visible');
}

function applyTheme(t) {
  setCurrentTheme(t);
  const root = document.documentElement;
  root.classList.add('theme-animating');
  root.setAttribute('data-theme', t);
  localStorage.setItem('nb_theme', t);
  $('icon-theme-dark').style.display = t === 'dark' ? 'block' : 'none';
  $('icon-theme-light').style.display = t === 'light' ? 'block' : 'none';
  if (typeof updateMonacoTheme === 'function') updateMonacoTheme();
  if (typeof window.applyTerminalTheme === 'function') window.applyTerminalTheme();
  if (_themeAnimTimer) clearTimeout(_themeAnimTimer);
  _themeAnimTimer = setTimeout(() => {
    root.classList.remove('theme-animating');
    _themeAnimTimer = null;
  }, 320);
}
