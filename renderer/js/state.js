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
  'Ты — ассистент Sirius IDE: помогаешь писать и править код проекта. ' +
  'Запись в проект — после разрешения пользователя; DELETE — только по явной просьбе (в .trash/ с подтверждением). ' +
  'Отвечай на языке пользователя. Будь точным.';

const LLM_SETTINGS_KEY = 'sirius_llm_provider_v1';
const LLM_API_KEY_SECRET = 'sirius.llm.apiKey';

const LLM_PROVIDER_PRESETS = {
  lmstudio: { id: 'lmstudio', label: 'LM Studio', baseUrl: 'http://127.0.0.1:1234/v1' },
  ollama: { id: 'ollama', label: 'Ollama', baseUrl: 'http://127.0.0.1:11434/v1' },
  custom: { id: 'custom', label: 'Свой OpenAI API', baseUrl: '' },
};

/** In-memory API key — never written into project files */
var _llmApiKeyMemory = '';
var _llmSecretsHydrated = false;

function defaultLLMSettings() {
  return {
    providerId: 'lmstudio',
    baseUrl: LLM_PROVIDER_PRESETS.lmstudio.baseUrl,
    apiKey: '',
    model: '',
    aiMode: 'agent',
  };
}

function publicLLMSettings(settings) {
  var s = settings || defaultLLMSettings();
  return {
    providerId: s.providerId || 'lmstudio',
    baseUrl: String(s.baseUrl || ''),
    model: String(s.model || ''),
    aiMode: s.aiMode === 'chat' ? 'chat' : 'agent',
  };
}

function getLLMSettings() {
  var base = defaultLLMSettings();
  try {
    const raw = localStorage.getItem(LLM_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      base = Object.assign(base, parsed || {});
    }
  } catch (_) {}
  // Prefer secure memory; migrate legacy plaintext localStorage key once
  if (_llmApiKeyMemory) {
    base.apiKey = _llmApiKeyMemory;
  } else if (base.apiKey) {
    _llmApiKeyMemory = String(base.apiKey);
  } else {
    base.apiKey = '';
  }
  return base;
}

function persistApiKeySecure(apiKey) {
  _llmApiKeyMemory = String(apiKey || '');
  try {
    if (window.api && typeof window.api.secureSet === 'function') {
      window.api.secureSet(LLM_API_KEY_SECRET, _llmApiKeyMemory).catch(function () {});
    }
  } catch (_) {}
}

async function hydrateApiKeyFromVault() {
  if (_llmSecretsHydrated) return _llmApiKeyMemory;
  _llmSecretsHydrated = true;
  try {
    if (window.api && typeof window.api.secureGet === 'function') {
      var fromVault = await window.api.secureGet(LLM_API_KEY_SECRET);
      if (fromVault != null && String(fromVault) !== '') {
        _llmApiKeyMemory = String(fromVault);
      }
    }
  } catch (_) {}
  // Migrate legacy plaintext key out of localStorage into vault
  try {
    var raw = localStorage.getItem(LLM_SETTINGS_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.apiKey) {
        if (!_llmApiKeyMemory) _llmApiKeyMemory = String(parsed.apiKey);
        delete parsed.apiKey;
        localStorage.setItem(LLM_SETTINGS_KEY, JSON.stringify(publicLLMSettings(parsed)));
        persistApiKeySecure(_llmApiKeyMemory);
      }
    }
  } catch (_) {}
  return _llmApiKeyMemory;
}

async function persistLlmSettingsToProject(settings) {
  if (!projectRoot || !window.api || !window.api.writeFile) return;
  try {
    var dir = siriusProjectDir(projectRoot);
    if (!dir) return;
    if (!(await window.api.exists(dir))) await window.api.mkdir(dir);
    var sep = dir.indexOf('/') !== -1 ? '/' : '\\';
    var pub = publicLLMSettings(settings);
    var payload = {
      version: 1,
      savedAt: new Date().toISOString(),
      note: 'API keys are NOT stored here — only in OS-encrypted user vault',
      llm: pub,
    };
    await window.api.writeFile(dir + sep + 'llm-settings.json', JSON.stringify(payload, null, 2));
  } catch (_) {}
}

async function readLlmSettingsFromProject(root) {
  var r = root || projectRoot;
  if (!r || !window.api || !window.api.readFile) return null;
  try {
    var dir = siriusProjectDir(r);
    if (!dir) return null;
    var sep = dir.indexOf('/') !== -1 ? '/' : '\\';
    var p = dir + sep + 'llm-settings.json';
    if (!(await window.api.exists(p))) return null;
    var data = JSON.parse(await window.api.readFile(p));
    if (!data) return null;
    if (data.llm && typeof data.llm === 'object') return publicLLMSettings(data.llm);
    return publicLLMSettings(data);
  } catch (_) {
    return null;
  }
}

function applyLlmPublicSettings(pub) {
  if (!pub || typeof pub !== 'object') return getLLMSettings();
  var patch = publicLLMSettings(pub);
  // Keep current secure key in memory
  var next = Object.assign(getLLMSettings(), patch, { apiKey: _llmApiKeyMemory || getLLMSettings().apiKey || '' });
  try { localStorage.setItem(LLM_SETTINGS_KEY, JSON.stringify(publicLLMSettings(next))); } catch (_) {}
  try {
    if (typeof applyProviderSelectUi === 'function') applyProviderSelectUi(next);
  } catch (_) {}
  try {
    var agentRadio = document.getElementById('ai-mode-agent');
    var chatRadio = document.getElementById('ai-mode-chat');
    if (agentRadio && chatRadio) {
      agentRadio.checked = next.aiMode === 'agent';
      chatRadio.checked = next.aiMode === 'chat';
    }
  } catch (_) {}
  return next;
}

function saveLLMSettings(patch) {
  const next = Object.assign(getLLMSettings(), patch || {});
  if (patch && Object.prototype.hasOwnProperty.call(patch, 'apiKey')) {
    persistApiKeySecure(next.apiKey);
  } else {
    next.apiKey = _llmApiKeyMemory || next.apiKey || '';
  }
  try { localStorage.setItem(LLM_SETTINGS_KEY, JSON.stringify(publicLLMSettings(next))); } catch (_) {}
  persistLlmSettingsToProject(next).catch(function () {});
  return next;
}

function getLLMProviderLabel(providerId) {
  const p = LLM_PROVIDER_PRESETS[providerId];
  return p ? p.label : (providerId || 'LLM');
}

function resolveLLMBaseUrl(settings) {
  const s = settings || getLLMSettings();
  const custom = String(s.baseUrl || '').trim().replace(/\/+$/, '');
  // User-entered URL always wins (paste / override), including over presets
  if (custom) {
    // normalize: allow host without /v1
    if (!/\/v1$/i.test(custom) && /^https?:\/\//i.test(custom)) {
      // keep as-is if path already present beyond origin
      try {
        var u = new URL(custom);
        if (!u.pathname || u.pathname === '/') return custom + '/v1';
      } catch (_) {}
    }
    return custom;
  }
  if (s.providerId === 'custom') return '';
  const preset = LLM_PROVIDER_PRESETS[s.providerId];
  return (preset && preset.baseUrl) ? preset.baseUrl : LLM_PROVIDER_PRESETS.lmstudio.baseUrl;
}

/** Infer provider from a pasted OpenAI-compatible URL */
function inferProviderFromBaseUrl(url) {
  var u = String(url || '').toLowerCase();
  if (!u) return null;
  if (/11434|ollama/.test(u)) return 'ollama';
  if (/1234|lmstudio|lm.?studio/.test(u)) return 'lmstudio';
  if (/^https?:\/\//.test(u)) return 'custom';
  return null;
}

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

var PROJECT_CACHE_MAX_FILE = 400000;
var PROJECT_CACHE_MAX_TOTAL = 2500000;
var _projectCacheWriteBusy = false;
var _projectCacheWriteQueued = false;

function siriusProjectDir(root) {
  var r = root || projectRoot;
  if (!r) return null;
  var sep = r.indexOf('/') !== -1 ? '/' : '\\';
  return r.replace(/[\\/]$/, '') + sep + '.sirius';
}

function collectOpenFileMeta() {
  var fileMeta = {};
  var total = 0;
  var order = openFilesOrder && openFilesOrder.length ? openFilesOrder.slice() : Object.keys(openFiles);
  for (var i = 0; i < order.length; i++) {
    var p = order[i];
    if (!openFiles[p]) continue;
    var content = (p === activeFile && editor) ? editor.getValue() : (openFiles[p].content || '');
    content = String(content || '');
    if (content.length > PROJECT_CACHE_MAX_FILE) {
      content = content.slice(0, PROJECT_CACHE_MAX_FILE);
    }
    if (total + content.length > PROJECT_CACHE_MAX_TOTAL) break;
    fileMeta[p] = content;
    total += content.length;
  }
  return { files: fileMeta, order: Object.keys(fileMeta) };
}

function buildStatePayload() {
  var collected = collectOpenFileMeta();
  var root = projectRoot || '';
  var active = activeFile || '';
  var layout = {
    sw: localStorage.getItem('nb_sw') || '',
    aw: localStorage.getItem('nb_aw') || '',
    th: localStorage.getItem('nb_th') || '',
  };
  try {
    if ($('sidebar')) layout.sw = String($('sidebar').offsetWidth || layout.sw || '');
    if ($('ai-panel')) layout.aw = String($('ai-panel').offsetWidth || layout.aw || '');
    if ($('term-panel')) layout.th = String($('term-panel').offsetHeight || layout.th || '');
  } catch (_) {}
  var cursor = null;
  try {
    if (editor && typeof editor.getPosition === 'function') {
      var pos = editor.getPosition();
      if (pos) cursor = { lineNumber: pos.lineNumber, column: pos.column };
    }
  } catch (_) {}
  var aiMode = 'agent';
  var llmPublic = null;
  try {
    if (typeof getLLMSettings === 'function') {
      var ls = getLLMSettings();
      aiMode = ls.aiMode || 'agent';
      llmPublic = publicLLMSettings(ls);
    }
  } catch (_) {}
  var agentSnap = null;
  try {
    if (typeof currentChat === 'function') {
      var ch = currentChat();
      if (ch && ch.agent && ch.agent.goal) {
        agentSnap = {
          goal: ch.agent.goal,
          status: ch.agent.status || '',
          summary: String(ch.agent.summary || '').slice(0, 4000),
          continues: ch.agent.continues || 0,
          updatedAt: ch.agent.updatedAt || null,
        };
      }
    }
  } catch (_) {}
  return {
    version: 2,
    savedAt: new Date().toISOString(),
    root: root,
    active: active,
    files: collected.files,
    order: collected.order,
    expanded: Array.from(expandedDirs || []),
    layout: layout,
    aiMode: aiMode,
    llm: llmPublic,
    cursor: cursor,
    editorSplit: localStorage.getItem('nb_editor_split') || '0',
    termSplit: localStorage.getItem('nb_term_split') || '0',
    agent: agentSnap,
  };
}

async function persistProjectCacheToDisk(payload) {
  if (!payload || !payload.root || !window.api || !window.api.writeFile) return;
  if (_projectCacheWriteBusy) {
    _projectCacheWriteQueued = true;
    return;
  }
  _projectCacheWriteBusy = true;
  try {
    var dir = siriusProjectDir(payload.root);
    if (!dir) return;
    if (!(await window.api.exists(dir))) await window.api.mkdir(dir);
    var sep = dir.indexOf('/') !== -1 ? '/' : '\\';
    var out = Object.assign({}, payload, { cacheKind: 'sirius-project-cache' });
    // Never persist secrets into the project tree
    if (out.llm) out.llm = publicLLMSettings(out.llm);
    if (out.apiKey) delete out.apiKey;
    if (out.llm && out.llm.apiKey) delete out.llm.apiKey;
    await window.api.writeFile(dir + sep + 'project-cache.json', JSON.stringify(out, null, 2));
    // llm-settings.json is written only via saveLLMSettings → persistLlmSettingsToProject
  } catch (_) {
  } finally {
    _projectCacheWriteBusy = false;
    if (_projectCacheWriteQueued) {
      _projectCacheWriteQueued = false;
      try { persistProjectCacheToDisk(buildStatePayload()); } catch (_2) {}
    }
  }
}

async function readProjectCacheFromDisk(root) {
  if (!root || !window.api || !window.api.readFile) return null;
  try {
    var dir = siriusProjectDir(root);
    if (!dir) return null;
    var sep = dir.indexOf('/') !== -1 ? '/' : '\\';
    var p = dir + sep + 'project-cache.json';
    if (!(await window.api.exists(p))) return null;
    var raw = await window.api.readFile(p);
    var data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch (_) {
    return null;
  }
}

function applyExpandedFromCache(list) {
  if (!Array.isArray(list) || !list.length) return;
  try {
    expandedDirs.clear();
    list.forEach(function (p) {
      if (p) expandedDirs.add(String(p));
    });
  } catch (_) {}
}

function applyLayoutFromCache(layout) {
  if (!layout || typeof layout !== 'object') return;
  try {
    if (layout.sw) localStorage.setItem('nb_sw', String(layout.sw));
    if (layout.aw) localStorage.setItem('nb_aw', String(layout.aw));
    if (layout.th) localStorage.setItem('nb_th', String(layout.th));
    if (typeof restorePanelSizes === 'function') restorePanelSizes();
    else {
      if (layout.sw && $('sidebar') && parseInt(layout.sw, 10) > 80) $('sidebar').style.width = parseInt(layout.sw, 10) + 'px';
      if (layout.aw && $('ai-panel') && parseInt(layout.aw, 10) > 100) $('ai-panel').style.width = parseInt(layout.aw, 10) + 'px';
      if (layout.th && $('term-panel') && parseInt(layout.th, 10) > 60) $('term-panel').style.height = parseInt(layout.th, 10) + 'px';
    }
  } catch (_) {}
}

function saveState() {
  try {
    var payloadObj = buildStatePayload();
    var fileMeta = payloadObj.files || {};
    var root = payloadObj.root || '';
    var active = payloadObj.active || '';
    var payload = JSON.stringify(payloadObj);
    localStorage.setItem('nb_root', root);
    localStorage.setItem('nb_files', JSON.stringify(fileMeta));
    localStorage.setItem('nb_active', active);
    try { localStorage.setItem('nb_expanded', JSON.stringify(payloadObj.expanded || [])); } catch (_) {}
    try { localStorage.setItem('nb_files_order', JSON.stringify(payloadObj.order || [])); } catch (_) {}
    try {
      if (window.api?.storeRendererState) window.api.storeRendererState(payload).catch(function () {});
      if (root && window.api?.saveProjectState) window.api.saveProjectState(payload).catch(function () {});
      if (root) persistProjectCacheToDisk(payloadObj).catch(function () {});
    } catch (_) {}
  } catch (_) {}
}

function hydrateOpenFilesFromMeta(meta, orderHint) {
  replaceOpenFiles({});
  var keys = Array.isArray(orderHint) && orderHint.length ? orderHint.filter(function (p) { return meta[p] != null; }) : Object.keys(meta || {});
  if (!keys.length) keys = Object.keys(meta || {});
  setOpenFilesOrder(keys);
  keys.forEach(function (p) {
    var content = String(meta[p] == null ? '' : meta[p]);
    openFiles[p] = { content: content, savedContent: content, modified: false };
  });
}

async function restoreState() {
  let root = '', filesJson = '{}', activePath = '';
  let expandedHint = null;
  let orderHint = null;
  let layoutHint = null;
  let cursorHint = null;
  let stateObj = null;
  try {
    const mainState = await window.api?.getRendererState?.();
    if (mainState?.root) {
      stateObj = mainState;
      root = mainState.root;
      filesJson = mainState.files ? JSON.stringify(mainState.files) : '{}';
      activePath = mainState.active || '';
      expandedHint = mainState.expanded || null;
      orderHint = mainState.order || null;
      layoutHint = mainState.layout || null;
      cursorHint = mainState.cursor || null;
    }
  } catch (_) {}
  if (!root) {
    root = localStorage.getItem('nb_root') || '';
    filesJson = localStorage.getItem('nb_files') || '{}';
    activePath = localStorage.getItem('nb_active') || '';
    try { expandedHint = JSON.parse(localStorage.getItem('nb_expanded') || 'null'); } catch (_) {}
    try { orderHint = JSON.parse(localStorage.getItem('nb_files_order') || 'null'); } catch (_) {}
  }
  if (!root) {
    try {
      const backup = await window.api?.loadProjectState?.();
      if (backup) {
        const d = JSON.parse(backup);
        stateObj = d;
        root = d.root || '';
        filesJson = d.files ? JSON.stringify(d.files) : '{}';
        activePath = d.active || '';
        expandedHint = d.expanded || expandedHint;
        orderHint = d.order || orderHint;
        layoutHint = d.layout || layoutHint;
        cursorHint = d.cursor || cursorHint;
      }
    } catch (_) {}
  }
  if (!root) return;

  // Project-local cache wins for expanded dirs / richer open set of this folder
  try {
    var diskCache = await readProjectCacheFromDisk(root);
    if (diskCache) {
      if ((!filesJson || filesJson === '{}') && diskCache.files) {
        filesJson = JSON.stringify(diskCache.files);
      }
      if (!activePath && diskCache.active) activePath = diskCache.active;
      if ((!orderHint || !orderHint.length) && diskCache.order) orderHint = diskCache.order;
      if ((!expandedHint || !expandedHint.length) && diskCache.expanded) expandedHint = diskCache.expanded;
      if (!layoutHint && diskCache.layout) layoutHint = diskCache.layout;
      if (!cursorHint && diskCache.cursor) cursorHint = diskCache.cursor;
      var llmFromDisk = diskCache.llm || null;
      if (!llmFromDisk && diskCache.aiMode) llmFromDisk = { aiMode: diskCache.aiMode };
      try {
        var llmFile = await readLlmSettingsFromProject(root);
        if (llmFile) llmFromDisk = Object.assign({}, llmFromDisk || {}, llmFile);
      } catch (_lf) {}
      if (llmFromDisk) applyLlmPublicSettings(llmFromDisk);
    }
  } catch (_) {}

  try {
    const meta = JSON.parse(filesJson);
    hydrateOpenFilesFromMeta(meta, orderHint);
  } catch (_) {}

  applyExpandedFromCache(expandedHint);
  applyLayoutFromCache(layoutHint);

  setProjectRoot(root);
  try { hideWelcome(); } catch (_) {}
  // Сначала зарегистрировать корень в main (addAllowedRoot), иначе refreshTree/openFile упадут по validatePath
  await window.api.watchDir(root).catch(() => {});
  try { await refreshTree(); } catch (_) {}

  if (activePath) {
    try {
      await openFile(activePath);
      if (cursorHint && editor && typeof editor.setPosition === 'function') {
        try {
          editor.setPosition(cursorHint);
          editor.revealPositionInCenter?.(cursorHint);
        } catch (_) {}
      }
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
          document.getElementById('editor-fallback')?.classList.remove('visible');
          const wrap = document.getElementById('editor-wrap');
          if (wrap) wrap.style.display = '';
          if (cursorHint && typeof editor.setPosition === 'function') {
            try {
              editor.setPosition(cursorHint);
              editor.revealPositionInCenter?.(cursorHint);
            } catch (_3) {}
          }
        } catch (_2) {}
      }
    }
  }

  try { refreshTabs(); } catch (_) {}
  try { updateGitStatus(); } catch (_) {}
  try { detectRunCommand(); } catch (_) {}
  try {
    if (typeof syncAIModeUI === 'function') syncAIModeUI();
    else if (typeof getLLMSettings === 'function') {
      var mode = getLLMSettings().aiMode || 'agent';
      var agentRadio = document.getElementById('ai-mode-agent');
      var chatRadio = document.getElementById('ai-mode-chat');
      if (agentRadio && chatRadio) {
        agentRadio.checked = mode === 'agent';
        chatRadio.checked = mode === 'chat';
      }
    }
  } catch (_) {}

  // Гарантированно скрыть приветствие и показать область редактора после восстановления
  const wel = document.getElementById('welcome');
  if (wel) wel.hidden = true;
  const wrap = document.getElementById('editor-wrap');
  if (wrap) wrap.style.display = '';
  document.getElementById('editor-fallback')?.classList.remove('visible');

  // Refresh disk cache after successful restore
  try { saveState(); } catch (_) {}
}

/** Restore tabs/expanded dirs from this project's .sirius cache after Open Folder */
async function restoreProjectCacheForRoot(root) {
  if (!root) return false;
  var cache = await readProjectCacheFromDisk(root);
  if (!cache) return false;
  try {
    if (cache.files && typeof cache.files === 'object') {
      hydrateOpenFilesFromMeta(cache.files, cache.order);
    }
    applyExpandedFromCache(cache.expanded);
    applyLayoutFromCache(cache.layout);
    var llmPatch = cache.llm || null;
    try {
      var llmFile2 = await readLlmSettingsFromProject(root);
      if (llmFile2) llmPatch = Object.assign({}, llmPatch || {}, llmFile2);
    } catch (_) {}
    if (!llmPatch && cache.aiMode) llmPatch = { aiMode: cache.aiMode };
    if (llmPatch) applyLlmPublicSettings(llmPatch);
    if (cache.active) {
      try { await openFile(cache.active); } catch (_) {}
      if (cache.cursor && editor && typeof editor.setPosition === 'function') {
        try {
          editor.setPosition(cache.cursor);
          editor.revealPositionInCenter?.(cache.cursor);
        } catch (_) {}
      }
    } else {
      try { refreshTabs(); } catch (_) {}
    }
    return true;
  } catch (_) {
    return false;
  }
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
