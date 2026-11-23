/* Sirius IDE — terminal.js */
'use strict';

const termInstances = new Map();
let activeTermId = null;
let termCounter = 0;
let splitTermEnabled = (function () {
  try { return localStorage.getItem('nb_term_split') === '1'; } catch (_) { return false; }
})();
let secondaryTermId = null;

function isLightTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light';
}

function getTerminalTheme() {
  if (isLightTheme()) {
    return {
      background: '#f4f5f7',
      foreground: '#1a1d24',
      cursor: '#4a6d8c',
      cursorAccent: '#f4f5f7',
      selectionBackground: 'rgba(74,109,140,.22)',
      black: '#3a3f4b', red: '#c44b4b', green: '#3d8f5f',
      yellow: '#a07a20', blue: '#4a6d8c', magenta: '#7a5f8c',
      cyan: '#3a7a8c', white: '#1a1d24',
      brightBlack: '#6b7280', brightRed: '#d35f5f', brightGreen: '#5faf7a',
      brightYellow: '#c9a227', brightBlue: '#6a8eae', brightMagenta: '#9a7aac',
      brightCyan: '#5a9aab', brightWhite: '#12141a',
    };
  }
  return {
    background: '#0e1014',
    foreground: '#d7dbe2',
    cursor: '#9bb4c9',
    cursorAccent: '#0e1014',
    selectionBackground: 'rgba(155,180,201,.28)',
    black: '#2a2e38', red: '#d35f5f', green: '#5faf7a',
    yellow: '#c9a227', blue: '#9bb4c9', magenta: '#a890b8',
    cyan: '#7eb8c9', white: '#d7dbe2',
    brightBlack: '#5c6370', brightRed: '#e07070', brightGreen: '#74c090',
    brightYellow: '#d4b84a', brightBlue: '#b4c9da', brightMagenta: '#b8a0c8',
    brightCyan: '#9bc8d4', brightWhite: '#e8eef3',
  };
}

function toggleTerminal() {
  const panel = $('term-panel');
  const isOpen = panel.classList.contains('open');
  panel.classList.toggle('open', !isOpen);
  document.querySelectorAll('.ab-btn[data-view="terminal"]').forEach(b => b.classList.toggle('active', !isOpen));
  if (!isOpen) {
    if (termInstances.size === 0) createTerminalTab();
    else {
      const inst = termInstances.get(activeTermId);
      inst?.fitAddon?.fit();
      if (splitTermEnabled && secondaryTermId) termInstances.get(secondaryTermId)?.fitAddon?.fit();
      inst?.xterm?.focus();
    }
  }
}

function chooseSecondaryTerm() {
  if (!splitTermEnabled) {
    secondaryTermId = null;
    return;
  }
  const ids = [...termInstances.keys()].filter(id => id !== activeTermId);
  secondaryTermId = ids.length ? ids[0] : null;
}

function applyTerminalSplitState() {
  const panel = $('term-panel');
  const btn = $('btn-split-term');
  if (panel) panel.classList.toggle('split-enabled', splitTermEnabled && !!secondaryTermId);
  if (btn) btn.classList.toggle('active', splitTermEnabled);
  for (const [id, inst] of termInstances) {
    inst.el.classList.toggle('active', id === activeTermId);
    inst.el.classList.toggle('active-secondary', splitTermEnabled && !!secondaryTermId && id === secondaryTermId);
  }
  setTimeout(() => {
    termInstances.get(activeTermId)?.fitAddon?.fit();
    if (splitTermEnabled && secondaryTermId) termInstances.get(secondaryTermId)?.fitAddon?.fit();
  }, 10);
}

function toggleTerminalSplit() {
  splitTermEnabled = !splitTermEnabled;
  try { localStorage.setItem('nb_term_split', splitTermEnabled ? '1' : '0'); } catch (_) {}
  chooseSecondaryTerm();
  applyTerminalSplitState();
}

async function createTerminalTab() {
  const id = uid();
  termCounter++;
  const name = `Terminal ${termCounter}`;
  const el = document.createElement('div');
  el.className = 'term-instance';
  el.id = 'term-' + id;
  $('term-instances').append(el);

  const xterm = new window.Terminal({
    theme: getTerminalTheme(),
    fontFamily: "'JetBrains Mono','Cascadia Code','Fira Code',Consolas,monospace",
    fontSize: 12.5,
    lineHeight: 1.45,
    cursorBlink: true,
    allowTransparency: false,
    convertEol: true,
    scrollback: 3000,
  });
  const fitAddon = new window.FitAddon.FitAddon();
  xterm.loadAddon(fitAddon);
  xterm.open(el);

  let backendId = null;
  try {
    const cwd = projectRoot || undefined;
    backendId = cwd
      ? await window.api.terminalCreateInCwd(cwd)
      : await window.api.terminalCreate();
  } catch (_) {}

  let cleanupListener = () => {};
  if (backendId) {
    xterm.onData(d => window.api.terminalWrite(backendId, d));
    cleanupListener = window.api.terminalOnData((bid, data) => {
      if (bid === backendId) xterm.write(data);
    });
  } else {
    xterm.writeln('\r\x1b[33mТерминал недоступен — пересоберите node-pty:\x1b[0m');
    xterm.writeln('\r  npm run rebuild:native');
  }

  async function pasteIntoTerm() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      if (backendId) await window.api.terminalWrite(backendId, text);
      else xterm.write(text);
    } catch (_) {
      if (typeof toast === 'function') toast('Не удалось прочитать буфер обмена', 'error', 2000);
    }
  }

  // Ctrl+V / Shift+Insert paste into shell
  xterm.attachCustomKeyEventHandler((ev) => {
    if (ev.type !== 'keydown') return true;
    const pasteKey = (ev.ctrlKey && (ev.key === 'v' || ev.key === 'V')) ||
      (ev.shiftKey && ev.key === 'Insert');
    if (pasteKey) {
      pasteIntoTerm();
      return false;
    }
    return true;
  });

  el.addEventListener('paste', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const text = ev.clipboardData && ev.clipboardData.getData('text');
    if (!text) return;
    if (backendId) window.api.terminalWrite(backendId, text);
    else xterm.write(text);
  });

  el.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    pasteIntoTerm();
  });

  termInstances.set(id, { xterm, fitAddon, backendId, el, name, cleanupListener, pasteIntoTerm });

  switchTerminalTab(id);
  setTimeout(() => { fitAddon.fit(); xterm.focus(); }, 80);

  const ro = new ResizeObserver(() => { if (activeTermId === id) fitAddon.fit(); });
  ro.observe(el);

  return id;
}

function switchTerminalTab(id) {
  activeTermId = id;
  if (splitTermEnabled && secondaryTermId === activeTermId) chooseSecondaryTerm();
  renderTermTabs();
  applyTerminalSplitState();
  setTimeout(() => termInstances.get(id)?.xterm?.focus(), 30);
}

function closeTerminalTab(id) {
  const inst = termInstances.get(id);
  if (!inst) return;
  inst.cleanupListener?.();
  if (inst.backendId) window.api.terminalKill(inst.backendId).catch(() => {});
  inst.xterm.dispose();
  inst.el.remove();
  termInstances.delete(id);
  if (secondaryTermId === id) secondaryTermId = null;
  if (activeTermId === id) {
    const remaining = [...termInstances.keys()];
    if (remaining.length) switchTerminalTab(remaining[remaining.length - 1]);
    else { activeTermId = null; $('term-panel').classList.remove('open'); }
  }
  chooseSecondaryTerm();
  renderTermTabs();
  applyTerminalSplitState();
}

function renderTermTabs() {
  const tabs = $('term-tabs');
  tabs.innerHTML = '';
  for (const [id, inst] of termInstances) {
    const tab = document.createElement('div');
    tab.className = 'term-tab' + (id === activeTermId ? ' active' : '');
    tab.innerHTML = `<span>${inst.name}</span><button class="term-tab-close">✕</button>`;
    tab.addEventListener('click', ev => { if (!ev.target.closest('.term-tab-close')) switchTerminalTab(id); });
    tab.addEventListener('mousedown', ev => {
      if (ev.button === 1) ev.preventDefault();
    });
    tab.addEventListener('auxclick', ev => {
      if (ev.button === 1) {
        ev.preventDefault();
        closeTerminalTab(id);
      }
    });
    tab.querySelector('.term-tab-close').addEventListener('click', ev => { ev.stopPropagation(); closeTerminalTab(id); });
    tabs.append(tab);
  }
}

function applyTerminalTheme() {
  var theme = getTerminalTheme();
  for (const inst of termInstances.values()) {
    if (inst.xterm && inst.xterm.options) inst.xterm.options.theme = theme;
  }
}

if (typeof window !== 'undefined') window.applyTerminalTheme = applyTerminalTheme;
if (typeof window !== 'undefined') window.toggleTerminalSplit = toggleTerminalSplit;
