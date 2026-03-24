/* Sirius IDE — state.js */
'use strict';

// Shared state (global for cross-module access)
let projectRoot = null;
let openFiles   = {};
let openFilesOrder = []; // порядок вкладок для отображения и перетаскивания
let activeFile  = null;
let editor      = null;
let monaco      = null;
let aiDecoIds   = [];
let _dragSrc         = null;
let _dragCurrentOver = null;
let _clipboard = null;
const expandedDirs = new Set();

const DEFAULT_SYSPROMPT =
  'Ты — экспертный ИИ-ассистент в среде Sirius IDE: помогаешь писать и рефакторить код, отвечаешь на вопросы по проекту. Отвечай на языке пользователя. Будь точным и действуй по инструкциям ниже.';

function getSystemPrompt() {
  return localStorage.getItem('nb_sysprompt') || DEFAULT_SYSPROMPT;
}

let currentTheme = localStorage.getItem('nb_theme') || 'dark';

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
    openFilesOrder = Object.keys(meta);
    for (const [p, content] of Object.entries(meta)) {
      openFiles[p] = { content: String(content), savedContent: String(content), modified: false };
    }
  } catch (_) {}

  projectRoot = root;
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
          activeFile = activePath;
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
  currentTheme = t;
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('nb_theme', t);
  $('icon-theme-dark').style.display = t === 'dark' ? 'block' : 'none';
  $('icon-theme-light').style.display = t === 'light' ? 'block' : 'none';
  if (editor && monaco) {
    var editorTheme = t === 'light' ? 'vs' : (localStorage.getItem('nb_editor_theme') || 'vs-dark');
    try { monaco.editor.setTheme(editorTheme); } catch (_) { monaco.editor.setTheme(t === 'light' ? 'vs' : 'vs-dark'); }
  }
  if (typeof window.applyTerminalTheme === 'function') window.applyTerminalTheme();
}
