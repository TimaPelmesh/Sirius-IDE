/* Sirius IDE — terminal.js */
'use strict';

const termInstances = new Map();
let activeTermId = null;
let termCounter = 0;

function isLightTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light';
}

function getTerminalTheme() {
  if (isLightTheme()) {
    return {
      background: '#f9fafb',
      foreground: '#111827',
      cursor: '#4F46E5',
      cursorAccent: '#f9fafb',
      selectionBackground: 'rgba(79,70,229,.2)',
      black: '#374151', red: '#dc2626', green: '#059669',
      yellow: '#d97706', blue: '#4F46E5', magenta: '#7c3aed',
      cyan: '#0891b2', white: '#111827',
      brightBlack: '#6b7280', brightRed: '#ef4444', brightGreen: '#10b981',
      brightYellow: '#f59e0b', brightBlue: '#6366f1', brightMagenta: '#8b5cf6',
      brightCyan: '#06b6d4', brightWhite: '#1f2937',
    };
  }
  return {
    background: '#0e0e10',
    foreground: '#d4d4de',
    cursor: '#5c9cf5',
    cursorAccent: '#0e0e10',
    selectionBackground: 'rgba(92,156,245,.3)',
    black: '#2a2a36', red: '#f27171', green: '#7be0a8',
    yellow: '#f2c46d', blue: '#5c9cf5', magenta: '#c792ea',
    cyan: '#89ddff', white: '#d4d4de',
    brightBlack: '#565676', brightRed: '#ff7b7b', brightGreen: '#9effc6',
    brightYellow: '#ffd97d', brightBlue: '#82b1ff', brightMagenta: '#e2adff',
    brightCyan: '#9effff', brightWhite: '#ffffff',
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
      inst?.xterm?.focus();
    }
  }
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
    fontFamily: "'Cascadia Code','Fira Code',Consolas,monospace",
    fontSize: 13,
    lineHeight: 1.4,
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
    xterm.writeln('\r  npm run postinstall');
  }

  termInstances.set(id, { xterm, fitAddon, backendId, el, name, cleanupListener });

  switchTerminalTab(id);
  setTimeout(() => { fitAddon.fit(); xterm.focus(); }, 80);

  const ro = new ResizeObserver(() => { if (activeTermId === id) fitAddon.fit(); });
  ro.observe(el);

  return id;
}

function switchTerminalTab(id) {
  for (const [tid, inst] of termInstances) {
    inst.el.classList.toggle('active', tid === id);
  }
  activeTermId = id;
  renderTermTabs();
  setTimeout(() => {
    const inst = termInstances.get(id);
    inst?.fitAddon?.fit();
    inst?.xterm?.focus();
  }, 30);
}

function closeTerminalTab(id) {
  const inst = termInstances.get(id);
  if (!inst) return;
  inst.cleanupListener?.();
  if (inst.backendId) window.api.terminalKill(inst.backendId).catch(() => {});
  inst.xterm.dispose();
  inst.el.remove();
  termInstances.delete(id);
  if (activeTermId === id) {
    const remaining = [...termInstances.keys()];
    if (remaining.length) switchTerminalTab(remaining[remaining.length - 1]);
    else { activeTermId = null; $('term-panel').classList.remove('open'); }
  }
  renderTermTabs();
}

function renderTermTabs() {
  const tabs = $('term-tabs');
  tabs.innerHTML = '';
  for (const [id, inst] of termInstances) {
    const tab = document.createElement('div');
    tab.className = 'term-tab' + (id === activeTermId ? ' active' : '');
    tab.innerHTML = `<span>${inst.name}</span><button class="term-tab-close">✕</button>`;
    tab.addEventListener('click', ev => { if (!ev.target.closest('.term-tab-close')) switchTerminalTab(id); });
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
