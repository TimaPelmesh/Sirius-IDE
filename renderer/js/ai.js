/* Sirius IDE — ai.js */
'use strict';

let chats = [];
let currentChatId = null;
const LM_URL = 'http://127.0.0.1:1234/v1'; // fallback при отсутствии прокси (CORS может блокировать)
let _aiRequestInFlight = false;

function loadChats() {
  try {
    const raw = localStorage.getItem('nb_chats');
    if (raw) chats = JSON.parse(raw);
  } catch (_) {}
  if (!chats.length) chats = [{ id: uid(), name: 'Чат 1', messages: [] }];
  currentChatId = chats[0].id;
}

function saveChats() {
  try { localStorage.setItem('nb_chats', JSON.stringify(chats)); } catch (_) {}
}

function currentChat() { return chats.find(c => c.id === currentChatId) || chats[0]; }

function renderChatTabs() {
  const wrap = $('chat-tabs');
  wrap.innerHTML = '';
  for (const c of chats) {
    const tab = document.createElement('div');
    tab.className = 'chat-tab' + (c.id === currentChatId ? ' active' : '');
    const nameEl = document.createElement('span');
    nameEl.textContent = c.name;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'chat-tab-close';
    closeBtn.title = 'Удалить';
    closeBtn.textContent = '✕';
    tab.append(nameEl, closeBtn);
    tab.addEventListener('click', ev => { if (!ev.target.closest('.chat-tab-close')) switchChat(c.id); });
    nameEl.addEventListener('dblclick', () => openRenameChatModal(c.id));
    closeBtn.addEventListener('click', ev => { ev.stopPropagation(); deleteChat(c.id); });
    wrap.append(tab);
  }
}

function switchChat(id) {
  currentChatId = id;
  renderChatTabs();
  renderMessages();
}

function createNewChat() {
  const c = { id: uid(), name: `Чат ${chats.length + 1}`, messages: [] };
  chats.push(c);
  switchChat(c.id);
  saveChats();
}

function deleteChat(id) {
  if (chats.length <= 1) { toast('Нельзя удалить последний чат', 'info'); return; }
  chats = chats.filter(c => c.id !== id);
  if (currentChatId === id) currentChatId = chats[chats.length - 1].id;
  renderChatTabs();
  renderMessages();
  saveChats();
}

let _renameChatId = null;
function openRenameChatModal(id) {
  _renameChatId = id;
  const c = chats.find(x => x.id === id);
  $('modal-chat-input').value = c?.name || '';
  $('modal-chat-backdrop').style.display = 'flex';
  setTimeout(() => $('modal-chat-input').focus(), 50);
}

function applyRenameChat() {
  const name = $('modal-chat-input').value.trim();
  if (!name || !_renameChatId) return;
  const c = chats.find(x => x.id === _renameChatId);
  if (c) c.name = name;
  $('modal-chat-backdrop').style.display = 'none';
  renderChatTabs();
  saveChats();
}

function md(rawText) {
  // Phase 1: extract code blocks BEFORE any HTML escaping
  const blocks = [];
  var s = String(rawText || '').replace(/```(\w*)\r?\n?([\s\S]*?)```/g, function(_, lang, code) {
    var idx = blocks.length;
    blocks.push({ lang: (lang || '').toLowerCase().trim(), code: code.replace(/\n$/, '') });
    return '\x00BLK' + idx + '\x00';
  });

  // Phase 2: HTML-escape the non-code text
  s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Phase 3: inline markdown (safe — after escaping)
  s = s
    .replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br/>');

  // Phase 4: restore code blocks with syntax highlighting
  s = s.replace(/\x00BLK(\d+)\x00/g, function(_, idxStr) {
    var blk = blocks[parseInt(idxStr)];
    var lang = blk.lang;
    var code = blk.code;

    // Try Prism syntax highlighting
    var highlighted = '';
    try {
      if (window.Prism && lang) {
        var grammar = Prism.languages[lang]
          || Prism.languages[lang === 'sh' ? 'bash' : lang]
          || Prism.languages[lang === 'js' ? 'javascript' : lang]
          || Prism.languages[lang === 'ts' ? 'typescript' : lang]
          || Prism.languages[lang === 'py' ? 'python' : lang];
        if (grammar) highlighted = Prism.highlight(code, grammar, lang);
      }
    } catch (_) {}

    if (!highlighted) {
      highlighted = code
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    var displayLang = lang || 'code';
    var copyIconSvg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    var doneIconSvg  = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

    return '<div class="cb-wrap">'
      + '<div class="cb-header">'
      + '<span class="cb-lang">' + displayLang + '</span>'
      + '<button class="cb-copy" data-copy-icon="' + encodeURIComponent(copyIconSvg) + '" data-done-icon="' + encodeURIComponent(doneIconSvg) + '" title="\u041a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u043a\u043e\u0434">'
      + copyIconSvg + ' \u041a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c'
      + '</button>'
      + '</div>'
      + '<pre class="cb-pre language-' + lang + '"><code class="language-' + lang + '">' + highlighted + '</code></pre>'
      + '</div>';
  });

  return s;
}

function renderMarkdownSafe(text) {
  var html = md(String(text || ''));
  if (window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
    return window.DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'p', 'br', 'pre', 'code', 'strong', 'em',
        'h1', 'h2', 'h3', 'ul', 'ol', 'li',
        'span', 'div', 'button',
        'svg', 'path', 'polyline', 'rect', 'circle', 'line',
      ],
      ALLOWED_ATTR: [
        'class', 'title', 'data-copy-icon', 'data-done-icon',
        'width', 'height', 'viewBox',
        'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
        'points', 'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry',
      ],
    });
  }
  return html;
}

function renderMessages() {
  const container = $('ai-messages');
  const chat = currentChat();
  container.innerHTML = '';
  if (!chat || !chat.messages.length) {
    container.innerHTML = '<div class="ai-placeholder" id="ai-placeholder"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" opacity=".3"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><p>Задайте вопрос или попросите<br/>изменить код</p></div>';
    return;
  }
  for (const m of chat.messages) appendMessage(m.role, m.content, container, false);
  container.scrollTop = container.scrollHeight;
}

const COLLAPSE_THRESHOLD = 600;

function appendMessage(role, content, container, scroll = true) {
  const div = document.createElement('div');
  div.className = 'msg msg-' + role;
  const isLong = content.length > COLLAPSE_THRESHOLD;
  const roleLabel = role === 'user' ? 'Вы' : 'Sirius AI';
  var copyIcon = '<svg class="msg-copy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  var checkIcon = '<svg class="msg-copy-icon msg-copy-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  div.innerHTML = `
    <div class="msg-header">
      <span class="msg-role">${roleLabel}</span>
      <button type="button" class="msg-copy" title="Копировать">${copyIcon}</button>
    </div>
    <div class="msg-body${isLong ? ' collapsed' : ''}">${renderMarkdownSafe(content)}</div>
    ${isLong ? '<button type="button" class="msg-toggle">Показать полностью ▼</button>' : ''}
  `;
  var copyBtn = div.querySelector('.msg-copy');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      navigator.clipboard.writeText(content).then(function () {
        toast('Скопировано в буфер обмена', 'success', 2000);
        copyBtn.innerHTML = checkIcon;
        copyBtn.classList.add('msg-copy-done');
        copyBtn.title = 'Скопировано';
        setTimeout(function () {
          copyBtn.innerHTML = copyIcon;
          copyBtn.classList.remove('msg-copy-done');
          copyBtn.title = 'Копировать';
        }, 2000);
      }).catch(function () {
        toast('Не удалось скопировать', 'error', 2000);
      });
    });
  }
  if (isLong) {
    var btn = div.querySelector('.msg-toggle');
    var body = div.querySelector('.msg-body');
    btn.addEventListener('click', function () {
      var collapsed = body.classList.toggle('collapsed');
      btn.textContent = collapsed ? 'Показать полностью ▼' : 'Свернуть ▲';
    });
  }
  container.append(div);
  if (scroll) container.scrollTop = container.scrollHeight;
  return div;
}

function parseModelFromApiResponse(data) {
  if (!data || typeof data !== 'object') return null;
  const list = data.data ?? data.models ?? (Array.isArray(data) ? data : null);
  if (Array.isArray(list) && list.length) {
    const first = list[0];
    return typeof first === 'string' ? first : (first.id ?? first.name ?? null);
  }
  return null;
}

async function fetchModels() {
  const setOnline = (model) => {
    const nameEl = $('model-name');
    if (nameEl) { nameEl.textContent = model || 'Подключено'; nameEl.title = model || ''; }
    const aiDot = $('ai-dot');
    if (aiDot) aiDot.className = 'ai-dot online';
    const sbDot = $('sb-dot');
    if (sbDot) sbDot.className = 'sb-dot online';
    $('sb-lm').title = 'LM Studio: ' + (model || 'подключено');
  };
  const setOffline = () => {
    const nameEl = $('model-name');
    if (nameEl) { nameEl.textContent = 'Модель не подключена'; nameEl.title = 'LM Studio недоступен — запустите LM Studio и загрузите модель'; }
    const aiDot = $('ai-dot');
    if (aiDot) aiDot.className = 'ai-dot';
    const sbDot = $('sb-dot');
    if (sbDot) sbDot.className = 'sb-dot';
  };
  try {
    if (window.api?.getLMStudioModels) {
      const data = await window.api.getLMStudioModels();
      const model = parseModelFromApiResponse(data);
      if (model) setOnline(model); else setOffline();
      return;
    }
    const r = await fetch(`${LM_URL}/models`);
    const data = await r.json();
    const model = parseModelFromApiResponse(data);
    if (model) setOnline(model); else setOffline();
  } catch (_) {
    setOffline();
  }
}

var _currentStreamAbort = null;

var DEFAULT_TEMPERATURE = 0.4;
var MAX_TOKENS = 32768;

function getAIMode() {
  try {
    var chatEl = document.getElementById('ai-mode-chat');
    if (chatEl && chatEl.checked) return 'chat';
  } catch (_) {}
  return 'agent';
}

function getLMOptions(mode) {
  var temperature = DEFAULT_TEMPERATURE;
  try {
    // Chat mode can be a bit freer; agent mode stays conservative.
    if (mode === 'chat') temperature = 0.5;
  } catch (_) {}
  return { temperature, max_tokens: MAX_TOKENS };
}

function streamToLMStudio(messages, onChunk, signal, options) {
  var payload = { messages, temperature: (options && options.temperature) ?? DEFAULT_TEMPERATURE, max_tokens: (options && options.max_tokens) ?? MAX_TOKENS };
  if (options && options.response_format) payload.response_format = options.response_format;

  if (window.api?.streamLMStudioChat && window.api?.onLMStudioChunk && window.api?.onLMStudioStreamEnd && window.api?.onLMStudioStreamError) {
    return new Promise((resolve, reject) => {
      const unChunk = window.api.onLMStudioChunk(onChunk);
      const unEnd = window.api.onLMStudioStreamEnd(() => { unChunk(); unEnd(); unErr(); resolve(); });
      const unErr = window.api.onLMStudioStreamError((err) => { unChunk(); unEnd(); unErr(); reject(new Error(err)); });
      window.api.streamLMStudioChat(payload);
    });
  }
  return streamToLMStudioFallback(messages, onChunk, signal, options);
}

async function streamToLMStudioFallback(messages, onChunk, signal, options) {
  var body = { model: '', messages, stream: true, temperature: (options && options.temperature) ?? DEFAULT_TEMPERATURE, max_tokens: (options && options.max_tokens) ?? MAX_TOKENS };
  if (options && options.response_format) body.response_format = options.response_format;

  const resp = await fetch(`${LM_URL}/chat/completions`, {
    signal: signal || undefined,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  if (!resp.body) throw new Error('No response body');
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
        try {
          const j = JSON.parse(line.slice(6));
          const delta = j.choices?.[0]?.delta?.content;
          if (delta) onChunk(delta);
        } catch (_) {}
      }
    }
  } catch (e) {
    if (e && e.name === 'AbortError') throw new Error('Запрос остановлен');
    throw e;
  }
}

function resolveAIPath(arg) {
  let p = (arg || '').trim();
  const parts = p.split(/[/\\]/).filter(part => part.length > 0);
  // Do not "sanitize" characters here; file names may contain Cyrillic.
  p = parts.join('\\');
  if (!p) return projectRoot || '';
  if (isAbsPath(p)) return p;
  if (projectRoot) return projectRoot.replace(/[\\/]$/, '') + '\\' + p;
  return p;
}

function validateAndResolveToolPath(arg, cmd) {
  var raw = String(arg || '').trim();
  if (!projectRoot) return { error: 'Сначала откройте папку проекта' };
  if (!raw && cmd !== 'READDIR') return { error: 'Путь не указан' };
  if (raw && (isAbsPath(raw) || /^[a-zA-Z]:/.test(raw) || raw.startsWith('\\\\'))) {
    return { error: 'Разрешены только относительные пути внутри проекта' };
  }
  var parts = raw.split(/[/\\]/).filter(function (part) { return part.length > 0; });
  for (var i = 0; i < parts.length; i++) {
    var seg = parts[i];
    if (seg === '.' || seg === '..') return { error: 'Запрещены сегменты "." и ".." в путях' };
    if (/[\x00-\x1F]/.test(seg)) return { error: 'Путь содержит недопустимые символы' };
  }
  var rel = parts.join('\\');
  var base = projectRoot.replace(/[\\/]$/, '');
  var full = rel ? (base + '\\' + rel) : base;
  return { fullPath: full, relPath: rel };
}

async function buildProjectTree(dir, depth, maxDepth) {
  if (depth > maxDepth) return '';
  let entries;
  try { entries = await window.api.readDir(dir); } catch (_) { return ''; }
  let out = '';
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'dist') continue;
    out += '  '.repeat(depth) + (e.isDirectory ? '📁 ' : '📄 ') + e.name + '\n';
    if (e.isDirectory && depth < maxDepth) {
      out += await buildProjectTree(e.path, depth + 1, maxDepth);
    }
  }
  return out;
}

async function getProjectContextBlock() {
  if (!projectRoot) return '';
  try {
    const tree = await buildProjectTree(projectRoot, 0, 3);
    const name = projectRoot.split(/[\\/]/).pop();
    return `\n\n📁 Проект "${name}" (${projectRoot}):\n${tree || '(пусто)'}`;
  } catch (_) { return ''; }
}

var TOOL_NAMES = 'CREATEFILE|EDITFILE|READDIR|READFILE|DELETEFILE';
var MAX_TOOL_CALLS_PER_REPLY = 12;

// ── Token estimation ──────────────────────────────────────────
function estimateTokens(messages) {
  var chars = messages.reduce(function (acc, m) {
    return acc + String(m.content || '').length + 4;
  }, 0);
  return Math.ceil(chars / 3.5); // ~3.5 chars/token for mixed RU/EN
}

function updateTokenIndicator(messages) {
  var el = document.getElementById('ai-token-count');
  if (!el) return;
  if (!messages || !messages.length) { el.textContent = ''; return; }
  var est = estimateTokens(messages);
  var k = est >= 1000 ? (est / 1000).toFixed(1) + 'k' : String(est);
  var maxK = MAX_TOKENS >= 1000 ? (MAX_TOKENS / 1000).toFixed(0) + 'k' : String(MAX_TOKENS);
  el.textContent = k + ' / ' + maxK;
  var pct = est / MAX_TOKENS;
  el.className = 'ai-token-count' + (pct > 0.82 ? ' warn' : pct > 0.55 ? ' med' : '');
  el.title = 'Контекст: ~' + est.toLocaleString() + ' токенов из ' + MAX_TOKENS.toLocaleString();
}

// ── Tool step log ─────────────────────────────────────────────
function createExecLog() {
  var log = document.createElement('div');
  log.className = 'ai-exec-log';
  var title = document.createElement('div');
  title.className = 'ai-exec-log-title';
  title.textContent = 'Выполнение';
  log.appendChild(title);
  return log;
}

function addExecStep(log, cmd, arg) {
  var step = document.createElement('div');
  step.className = 'ai-exec-step pending';
  step.innerHTML =
    '<div class="ai-exec-step-icon"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="9"/></svg></div>' +
    '<span class="ai-exec-step-cmd">' + escapeHtml(cmd) + '</span>' +
    '<span class="ai-exec-step-arg">' + escapeHtml(arg) + '</span>' +
    '<span class="ai-exec-step-meta">ожидание</span>';
  log.appendChild(step);
  return step;
}

function setExecStepState(step, state, meta) {
  step.className = 'ai-exec-step ' + state;
  var metaEl = step.querySelector('.ai-exec-step-meta');
  if (metaEl) metaEl.textContent = meta || '';
  var iconEl = step.querySelector('.ai-exec-step-icon');
  if (!iconEl) return;
  if (state === 'running') {
    iconEl.innerHTML = ''; // CSS spinner via className
  } else if (state === 'done') {
    iconEl.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8"><polyline points="20 6 9 17 4 12"/></svg>';
  } else if (state === 'error') {
    iconEl.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  } else if (state === 'skipped') {
    iconEl.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  }
}

// ── Accept / Reject card for AI file writes ───────────────────
function buildSimpleDiff(oldText, newText) {
  const o = String(oldText || '').split('\n');
  const n = String(newText || '').split('\n');
  const added   = n.filter(l => !o.includes(l)).length;
  const removed = o.filter(l => !n.includes(l)).length;
  return { added, removed, oldLen: o.length, newLen: n.length };
}

function showAiChangeCard(cmd, fullPath, relPath, newContent, oldContent) {
  return new Promise((resolve) => {
    const msgArea = document.getElementById('ai-messages');
    if (!msgArea) { resolve(true); return; }

    const { added, removed, oldLen, newLen } = buildSimpleDiff(oldContent, newContent);
    const isNew = cmd === 'CREATEFILE' || !String(oldContent || '').trim();
    const fileName = relPath.split(/[\\/]/).pop();
    const ext = fileName.split('.').pop().toLowerCase();
    const previewLines = String(newContent || '').split('\n').slice(0, 12);
    const langClass = `language-${ext}`;

    const card = document.createElement('div');
    card.className = 'ai-change-card';
    card.innerHTML = `
      <div class="ai-change-header">
        <span class="ai-change-cmd ${isNew ? 'create' : 'edit'}">${isNew ? '+ Создать' : '✎ Изменить'}</span>
        <span class="ai-change-path" title="${fullPath}">${relPath}</span>
      </div>
      <div class="ai-change-stats">
        ${isNew
          ? `<span class="ai-change-stat new">Новый файл · ${newLen} строк</span>`
          : `<span class="ai-change-stat add">+${added}</span><span class="ai-change-stat rem">-${removed}</span><span class="ai-change-stat info">${oldLen}→${newLen} строк</span>`
        }
      </div>
      <details class="ai-change-preview">
        <summary>Предпросмотр</summary>
        <pre class="ai-change-pre"><code class="${langClass}">${escapeHtml(previewLines.join('\n'))}${previewLines.length < String(newContent || '').split('\n').length ? '\n…' : ''}</code></pre>
      </details>
      <div class="ai-change-actions">
        <button class="ai-change-reject">✕ Отклонить</button>
        <button class="ai-change-accept">✓ Принять</button>
      </div>
    `;

    msgArea.appendChild(card);
    msgArea.scrollTop = msgArea.scrollHeight;

    // Highlight preview if Prism is available
    if (window.Prism) {
      const codeEl = card.querySelector('code');
      if (codeEl) Prism.highlightElement(codeEl);
    }

    card.querySelector('.ai-change-accept').addEventListener('click', () => {
      card.classList.add('ai-change-accepted');
      setTimeout(() => card.remove(), 500);
      resolve(true);
    });
    card.querySelector('.ai-change-reject').addEventListener('click', () => {
      card.classList.add('ai-change-rejected');
      setTimeout(() => card.remove(), 500);
      resolve(false);
    });
  });
}

function parseToolCalls(text) {
  const tools = [];
  const re = new RegExp('\\[(' + TOOL_NAMES + '):([^\\]]*)\\]([\\s\\S]*?)(?=\\[(?:' + TOOL_NAMES + '):|$)', 'g');
  let m;
  while ((m = re.exec(text)) !== null) {
    let body = m[3].trim();
    body = body.replace(/^```[\w]*\r?\n([\s\S]*?)\r?\n```\s*$/, '$1').trim();
    tools.push({ cmd: m[1], arg: m[2].trim(), body });
  }
  return tools;
}

function extractJsonPayload(text) {
  var raw = String(text || '').trim();
  if (!raw) return null;
  raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    return JSON.parse(raw);
  } catch (_) {}
  var start = raw.indexOf('{');
  var end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(raw.slice(start, end + 1)); } catch (_) {}
  }
  return null;
}

function parseStructuredToolCalls(text) {
  var payload = extractJsonPayload(text);
  if (!payload || typeof payload !== 'object') return null;
  var rawTools = Array.isArray(payload.tool_calls) ? payload.tool_calls : [];
  var tools = [];
  for (var i = 0; i < rawTools.length; i++) {
    var t = rawTools[i];
    if (!t || typeof t !== 'object') continue;
    var cmd = String(t.cmd || '').toUpperCase().trim();
    if (!/^(CREATEFILE|EDITFILE|READDIR|READFILE|DELETEFILE)$/.test(cmd)) continue;
    tools.push({ cmd: cmd, arg: String(t.arg || '').trim(), body: String(t.body || '') });
  }
  return {
    reply: String(payload.assistant_reply || payload.reply || '').trim(),
    tools: tools,
  };
}

function looksLikeAgentJson(text) {
  var s = String(text || '').trim();
  if (!s) return false;
  return s.indexOf('"assistant_reply"') !== -1 || s.indexOf('"tool_calls"') !== -1;
}

function extractAssistantReplyPreview(text) {
  var s = String(text || '');
  var m = s.match(/"assistant_reply"\s*:\s*"([^"]*)/);
  if (!m || !m[1]) return '';
  return m[1]
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .trim();
}

function stripLeakedToolText(text) {
  var s = String(text || '');
  if (!s) return '';
  // Remove fenced tool_code blocks completely.
  s = s.replace(/```(?:tool_code|tools?|json)?\s*[\r\n]+[\s\S]*?```/gi, '');
  // Remove inline "tool_code" sections and command-like lines.
  s = s.replace(/(^|\n)\s*tool_code\s*\n[\s\S]*$/i, '$1');
  s = s.replace(/(^|\n)\s*(CREATEFILE|EDITFILE|READFILE|READDIR|DELETEFILE)\s*:\s*[^\n]*(\n|$)/gi, '$1');
  s = s.replace(/\[(CREATEFILE|EDITFILE|READFILE|READDIR|DELETEFILE):[^\]]*\][\s\S]*?(?=\[(?:CREATEFILE|EDITFILE|READFILE|READDIR|DELETEFILE):|$)/gi, '');
  return s.trim();
}

function cleanReply(text) {
  var structured = parseStructuredToolCalls(text);
  if (structured) return stripLeakedToolText(structured.reply);
  if (looksLikeAgentJson(text)) return stripLeakedToolText(extractAssistantReplyPreview(text));
  const re = new RegExp('\\[(' + TOOL_NAMES + '):[^\\]]*\\][\\s\\S]*?(?=\\[(?:' + TOOL_NAMES + '):|$)', 'g');
  return stripLeakedToolText(text.replace(re, '').trim());
}

var CMD_LABELS = {
  CREATEFILE: 'Создан файл',
  EDITFILE: 'Изменён файл',
  READFILE: 'Прочитан файл',
  READDIR: 'Содержимое директории',
  DELETEFILE: 'Удалён файл',
};

function hasFileWriteIntent(userText) {
  var s = String(userText || '').toLowerCase();
  // Matches explicit action verbs that imply writing/changing files.
  // The real safety gate is the per-file Accept/Reject card shown to the user;
  // this check only prevents the model from silently writing when the user
  // asked a purely informational question.
  return /(созда|измени|исправ|обнов|добав|перепиш|сделай|напиш|реализ|заполн|отрефактор|прорефактор|построй|реструктур|перенес|перемест|оптимиз|задокумент|покрой|генер|в файле|в код|create|edit|update|fix|refactor|implement|change|write|build|generate|add|modify|move|rename|optimize|document|patch)/i.test(s);
}

function hasDeleteIntent(userText) {
  var s = String(userText || '').toLowerCase();
  return /(удали|delete|remove|стер|снести|удалить файл|delete file)/i.test(s);
}

function hasClearFileIntent(userText) {
  var s = String(userText || '').toLowerCase();
  return /(очист|сделай пустым|truncate|clear file|empty file)/i.test(s);
}

function appendAiOpJournal(entry) {
  try {
    var key = 'sirius_ai_op_journal_v1';
    var arr = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(arr)) arr = [];
    arr.push(entry);
    // Keep latest 300 records to avoid unbounded growth.
    if (arr.length > 300) arr = arr.slice(arr.length - 300);
    localStorage.setItem(key, JSON.stringify(arr));
  } catch (_) {}
}

async function confirmRiskyOperation(t, fullPath, reason) {
  if (typeof showConfirm !== 'function') return true;
  var msg = 'AI хочет выполнить рискованную операцию:\n' +
    t.cmd + ' ' + t.arg + '\n\n' +
    'Причина: ' + reason + '\n\n' +
    'Разрешить?';
  return await showConfirm(msg, {
    title: 'Подтверждение AI-операции',
    okText: 'Разрешить',
    cancelText: 'Отмена',
    danger: true,
  });
}

async function execTools(tools, onToolProgress, userText) {
  const results = [];
  const actions = [];
  const details = [];
  const notify = (phase, t, idx, total, ok, error) => {
    if (typeof onToolProgress !== 'function') return;
    try { onToolProgress(phase, t, idx, total, ok, error); } catch (_) {}
  };
  var list = Array.isArray(tools) ? tools.slice(0, MAX_TOOL_CALLS_PER_REPLY) : [];
  var allowWrite = hasFileWriteIntent(userText);
  var allowClear = hasClearFileIntent(userText);
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    if (!t || !/^(CREATEFILE|EDITFILE|READDIR|READFILE|DELETEFILE)$/.test(t.cmd || '')) continue;
    var resolved = validateAndResolveToolPath(t.arg, t.cmd);
    if (resolved.error) {
      results.push(`Ошибка ${t.cmd} ${t.arg}: ${resolved.error}`);
      actions.push({ cmd: t.cmd, arg: t.arg, ok: false, error: resolved.error });
      details.push({ cmd: t.cmd, arg: t.arg, ok: false, error: resolved.error });
      continue;
    }
    const fullPath = resolved.fullPath;
    notify('start', t, i, list.length);
    try {
      if (t.cmd === 'CREATEFILE' || t.cmd === 'EDITFILE') {
        if (!allowWrite) {
          var noWrite = 'Запись в файлы заблокирована: в запросе нет явного действия изменения файлов';
          results.push(`Ошибка ${t.cmd} ${t.arg}: ${noWrite}`);
          actions.push({ cmd: t.cmd, arg: t.arg, ok: false, error: noWrite });
          details.push({ cmd: t.cmd, arg: t.arg, ok: false, error: noWrite });
          notify('done', t, i, list.length, false, noWrite);
          continue;
        }
        if (!String(t.body || '').trim()) {
          var emptyBody = 'Пустое содержимое файла запрещено без явного запроса';
          results.push(`Ошибка ${t.cmd} ${t.arg}: ${emptyBody}`);
          actions.push({ cmd: t.cmd, arg: t.arg, ok: false, error: emptyBody });
          details.push({ cmd: t.cmd, arg: t.arg, ok: false, error: emptyBody });
          notify('done', t, i, list.length, false, emptyBody);
          continue;
        }
        const originalContent = openFiles[fullPath]?.content || '';
        if (t.cmd === 'EDITFILE' && String(originalContent).trim() && !String(t.body).trim()) {
          var clearBlocked = 'Очистка файла заблокирована без явного запроса пользователя';
          results.push(`Ошибка ${t.cmd} ${t.arg}: ${clearBlocked}`);
          actions.push({ cmd: t.cmd, arg: t.arg, ok: false, error: clearBlocked });
          details.push({ cmd: t.cmd, arg: t.arg, ok: false, error: clearBlocked });
          notify('done', t, i, list.length, false, clearBlocked);
          continue;
        }
        if (t.cmd === 'EDITFILE' && String(originalContent).trim() && !allowClear) {
          var beforeLen = String(originalContent).length;
          var afterLen = String(t.body).length;
          if (beforeLen > 200 && afterLen < Math.floor(beforeLen * 0.1)) {
            var destructiveEdit = 'Подозрение на потерю содержимого: резкое сокращение файла без явного запроса';
            results.push(`Ошибка ${t.cmd} ${t.arg}: ${destructiveEdit}`);
            actions.push({ cmd: t.cmd, arg: t.arg, ok: false, error: destructiveEdit });
            details.push({ cmd: t.cmd, arg: t.arg, ok: false, error: destructiveEdit });
            notify('done', t, i, list.length, false, destructiveEdit);
            continue;
          }
          if (beforeLen > 200 && afterLen < Math.floor(beforeLen * 0.5)) {
            var okRisk = await confirmRiskyOperation(t, fullPath, 'сильное сокращение контента');
            if (!okRisk) {
              var deniedRisk = 'Отклонено пользователем: рискованная операция';
              results.push(`Ошибка ${t.cmd} ${t.arg}: ${deniedRisk}`);
              actions.push({ cmd: t.cmd, arg: t.arg, ok: false, error: deniedRisk });
              details.push({ cmd: t.cmd, arg: t.arg, ok: false, error: deniedRisk });
              appendAiOpJournal({
                ts: new Date().toISOString(),
                cmd: t.cmd,
                arg: t.arg,
                fullPath: fullPath,
                ok: false,
                blocked: true,
                reason: deniedRisk,
              });
              notify('done', t, i, list.length, false, deniedRisk);
              continue;
            }
          }
        }
        // ── Show Accept/Reject card before writing ──────────
        const accepted = await showAiChangeCard(t.cmd, fullPath, t.arg, t.body, originalContent);
        if (!accepted) {
          const rejected = 'Отклонено пользователем';
          results.push(`${t.cmd} ${t.arg}: ${rejected}`);
          actions.push({ cmd: t.cmd, arg: t.arg, ok: false, error: rejected });
          details.push({ cmd: t.cmd, arg: t.arg, ok: false, error: rejected });
          notify('done', t, i, list.length, false, rejected);
          continue;
        }
        await window.api.writeFile(fullPath, t.body);
        if (!openFiles[fullPath]) openFiles[fullPath] = { content: t.body, savedContent: t.body, modified: false };
        else {
          openFiles[fullPath].content = t.body;
          openFiles[fullPath].modified = false;
        }
        await openFile(fullPath);
        highlightAiChanges(originalContent, t.body);
        await refreshTree();
        results.push(`${t.cmd} ${t.arg}: OK`);
        actions.push({ cmd: t.cmd, arg: t.arg, ok: true });
        details.push({ cmd: t.cmd, arg: t.arg, ok: true });
        appendAiOpJournal({
          ts: new Date().toISOString(),
          cmd: t.cmd,
          arg: t.arg,
          fullPath: fullPath,
          ok: true,
        });
        toast(t.cmd === 'CREATEFILE' ? 'Создан: ' + t.arg : 'Изменён: ' + t.arg, 'success');
      } else if (t.cmd === 'DELETEFILE') {
        // Move to .trash instead of permanent delete — fully recoverable.
        const sep = projectRoot.includes('/') ? '/' : '\\';
        const trashDir = projectRoot.replace(/[\\/]$/, '') + sep + '.trash';
        if (!(await window.api.exists(trashDir))) {
          await window.api.mkdir(trashDir);
        }
        const fileName = (t.arg || '').replace(/[/\\]/g, sep).split(sep).pop();
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
        const trashName = fileName + '__' + ts;
        const trashPath = trashDir + sep + trashName;
        await window.api.rename(fullPath, trashPath);
        if (openFiles[fullPath]) {
          if (activeFile === fullPath) closeTab(fullPath);
          else delete openFiles[fullPath];
          if (openFilesOrder) {
            const nextOrder = openFilesOrder.filter(function (p) { return p !== fullPath; });
            if (typeof setOpenFilesOrder === 'function') setOpenFilesOrder(nextOrder);
            else openFilesOrder = nextOrder;
          }
        }
        refreshTree();
        results.push(`DELETEFILE ${t.arg}: moved to .trash/${trashName}`);
        actions.push({ cmd: t.cmd, arg: t.arg, ok: true });
        details.push({ cmd: t.cmd, arg: t.arg, ok: true });
        appendAiOpJournal({
          ts: new Date().toISOString(),
          cmd: t.cmd,
          arg: t.arg,
          fullPath: fullPath,
          ok: true,
          trash: trashPath,
        });
        toast('В корзину: ' + t.arg, 'info');
      } else if (t.cmd === 'READDIR') {
        const entries = await window.api.readDir(fullPath);
        const listing = entries.map(function (e) { return (e.isDirectory ? '📁 ' : '📄 ') + e.name; }).join('\n');
        results.push(`READDIR ${t.arg}:\n${listing}`);
        actions.push({ cmd: t.cmd, arg: t.arg, ok: true });
        details.push({ cmd: t.cmd, arg: t.arg, ok: true, data: listing });
      } else if (t.cmd === 'READFILE') {
        const content = await window.api.readFile(fullPath);
        results.push(`READFILE ${t.arg}:\n${content}`);
        actions.push({ cmd: t.cmd, arg: t.arg, ok: true });
        details.push({ cmd: t.cmd, arg: t.arg, ok: true, data: content });
      }
      notify('done', t, i, list.length, true, null);
    } catch (e) {
      results.push(`Ошибка ${t.cmd} ${t.arg}: ${e.message}`);
      actions.push({ cmd: t.cmd, arg: t.arg, ok: false, error: e.message });
      details.push({ cmd: t.cmd, arg: t.arg, ok: false, error: e.message });
      appendAiOpJournal({
        ts: new Date().toISOString(),
        cmd: t.cmd,
        arg: t.arg,
        fullPath: fullPath,
        ok: false,
        error: String(e && e.message || e || ''),
      });
      notify('done', t, i, list.length, false, e.message);
    }
  }
  return { apiText: results.join('\n\n'), actions: actions, details: details };
}

function formatToolResultsForModel(details) {
  if (!details || !details.length) return '';
  var lines = ['<tool_results>'];
  var maxDataChars = 32000;
  for (var i = 0; i < details.length; i++) {
    var d = details[i];
    lines.push('[' + d.cmd + ':' + d.arg + '] → ' + (d.ok ? 'success' : 'error: ' + (d.error || '')));
    if (d.ok && d.data !== undefined) lines.push('<data>\n' + String(d.data).slice(0, maxDataChars) + '\n</data>');
  }
  lines.push('</tool_results>');
  return lines.join('\n');
}

function highlightAiChanges(originalContent, newContent) {
  if (!editor || !monaco) return;
  const origLines = originalContent.split('\n');
  const newLines  = newContent.split('\n');
  const decorations = [];
  for (let i = 0; i < newLines.length; i++) {
    if (i >= origLines.length || newLines[i] !== origLines[i]) {
      decorations.push({
        range: new monaco.Range(i + 1, 1, i + 1, 1),
        options: {
          isWholeLine: true,
          className: i < origLines.length ? 'ai-changed-line' : 'ai-added-line',
        },
      });
    }
  }
  aiDecoIds = editor.deltaDecorations(aiDecoIds, decorations);
  setTimeout(() => { aiDecoIds = editor.deltaDecorations(aiDecoIds, []); }, 8000);
}

function buildContext() {
  if (!activeFile) return '';
  const content = editor ? editor.getValue() : (openFiles[activeFile]?.content || '');
  const name = activeFile.split(/[\\/]/).pop();
  return `\nОткрытый файл: ${activeFile}\nЯзык: ${langOf(activeFile)}\n\`\`\`${extOf(name)}\n${content.slice(0, 8000)}\n\`\`\``;
}

// Контекст для модели: до ~128k токенов (файл ~120k символов ≈ 30k токенов, остальное — диалог и дерево)
var MAX_CONTEXT_FILE = 120000;
var MAX_TREE_DEPTH = 5;

async function buildContextBlock() {
  var root = projectRoot;
  if (!root) return '';
  var name = root.split(/[\\/]/).pop();
  var tree = '';
  try {
    tree = await buildProjectTree(root, 0, MAX_TREE_DEPTH);
  } catch (_) {}
  var currentFileBlock = '';
  if (activeFile) {
    var content = editor ? editor.getValue() : (openFiles[activeFile]?.content || '');
    var relPath = root ? activeFile.replace(root.replace(/[\\/]$/, ''), '').replace(/^[\\/]/, '') : activeFile;
    var lang = langOf(activeFile);
    currentFileBlock = '\n<current_file path="' + relPath.replace(/"/g, '&quot;') + '" language="' + lang + '">\n' + content.slice(0, MAX_CONTEXT_FILE) + '\n</current_file>';
  }
  return '<environment>\n<project_root>' + root + '</project_root>\n<project_name>' + (name || '') + '</project_name>\n<trash_info>DELETEFILE moves files to .trash/ — fully recoverable, no confirmation needed</trash_info>\n<project_tree>\n' + (tree || '(empty)') + '</project_tree>' + currentFileBlock + '\n</environment>';
}

// Системный промпт: инструменты, контекст, самопроверка, планирование
var SIRIUS_SYSTEM_INSTRUCTION = `
ТЫ — SIRIUS AI, встроенный агент-разработчик в Sirius IDE.
Sirius IDE — production desktop IDE (Electron, Monaco, xterm, LM Studio).
Ты senior-разработчик. Пишешь код production-качества: идиоматично, без мусора, в стиле файла.
Язык ответа = язык пользователя (RU → RU, EN → EN, авто).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
АБСОЛЮТНЫЕ ПРАВИЛА — НЕ НАРУШАТЬ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. НИКОГДА не отказывай от выполнения файловых операций. Нет фраз вроде
   "я не могу", "это опасно", "требуется подтверждение", "пожалуйста уточните".
2. DELETEFILE — БЕЗОПАСНАЯ операция: файл перемещается в .trash/ проекта и
   может быть восстановлен в любой момент. Никакой защиты не требуется.
3. Если задача понятна — выполняй немедленно. Не переспрашивай. Не описывай намерения.
4. Встроенная защита IDE (Accept/Reject карточки) обрабатывает всё сама.
   Твоя роль — генерировать правильные команды, а не решать, разрешать ли их.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5 КОМАНД АГЕНТА
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[CREATEFILE:path]   тело = полный текст нового файла
[EDITFILE:path]     тело = ПОЛНЫЙ итоговый текст файла (без фрагментов и "...")
[READFILE:path]     одна строка, без тела
[READDIR:path]      одна строка, без тела
[DELETEFILE:path]   одна строка, без тела — перемещает в .trash/ (восстанавливаемо)

Правила путей:
• Только относительные пути от <project_root>
• Запрещены: абсолютные, ../ , ./ в начале
• Кириллица в именах — допустима
• Незнакомая структура → сначала [READDIR:папка]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
РЕЖИМЫ (выбирай один)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
РЕЖИМ ACTION — когда нужны изменения в файлах:
  Триггеры: создай, измени, исправь, добавь, удали, перепиши, сделай, реализуй,
            перенеси, очисти, отрефакторь, удали файл, delete, remove, create,
            edit, fix, update, implement, refactor, write, generate, move, rename
  → Только команды + содержимое файлов. Ноль лишнего текста.
  → Сначала READFILE/READDIR если не знаешь содержимое.
  → Все операции (EDITFILE, DELETEFILE, CREATEFILE) — в одном ответе.

РЕЖИМ ANSWER — вопросы, объяснения, анализ:
  Триггеры: объясни, что такое, как работает, найди, оцени, покажи пример
  → Структурированный текст, примеры в \`\`\`lang\`\`\`.
  → READFILE/READDIR можно использовать для сбора информации.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ЦИКЛ АГЕНТА: Observe → Plan → Act → Verify
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OBSERVE: Если задача затрагивает файлы — прочитай их сначала.
         [READDIR:папка] → видишь структуру. [READFILE:файл] → видишь содержимое.
         Не угадывай содержимое — читай.

PLAN:    Молча строй план. Учитывай зависимости между файлами.

ACT:     Выполняй. EDITFILE/CREATEFILE — полный итоговый текст файла целиком.
         Несколько операций — все в одном ответе последовательно.
         DELETEFILE — просто команда, никаких предупреждений, файл уходит в .trash/.

VERIFY:  После tool_results: всё выполнено? Ошибки? → исправь автоматически.
         Максимум 3 раунда. Если не получилось за 3 раунда — объясни причину.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
СТАНДАРТЫ КОДА
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• EDITFILE — ВСЕГДА полный текст файла. Никаких "// ... остальное без изменений"
• Сохраняй стиль файла: отступы, кавычки, именование
• Не добавляй комментарии "// изменено AI"
• TypeScript: сохраняй типы, не используй any без нужды
• Python: PEP8, f-strings, type hints если уже есть
• JS: ES2020+, const/arrow/async-await

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
КОНТЕКСТ СРЕДЫ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<environment> содержит:
  <project_root>          — абсолютный путь к проекту
  <project_tree>          — структура файлов (3 уровня)
  <current_file path="…"> — открытый файл + его содержимое

[CONTEXT_REFRESH] — автообновление после каждого раунда. Используй свежие данные.
• "этот файл" / "текущий файл" = path из <current_file>
• Не выдумывай структуру — только из <project_tree> и tool_results

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
САМОПРОВЕРКА (молча)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Прочитал файлы перед редактированием?
✓ EDITFILE содержит полный текст файла (не фрагмент)?
✓ Пути относительные, без ../  и абсолютных?
✓ Ответ выполняет задачу (не описывает намерение)?
✓ После tool_results проверил ошибки и исправил если нужно?
`;

var MAX_TOOL_ROUNDS = 3;
var AGENT_JSON_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'sirius_agent_round',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        assistant_reply: { type: 'string' },
        tool_calls: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              cmd: { type: 'string' },
              arg: { type: 'string' },
              body: { type: 'string' },
            },
            required: ['cmd', 'arg', 'body'],
          },
        },
      },
      required: ['assistant_reply', 'tool_calls'],
    },
  },
};

async function sendMessage() {
  if (_aiRequestInFlight) {
    if (_currentStreamAbort) _currentStreamAbort.abort();
    if (window.api && window.api.abortLMStudioStream) window.api.abortLMStudioStream();
    return;
  }
  const inp = $('ai-input');
  const text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  inp.style.height = 'auto';
  var sendBtn = $('ai-send');
  var sendBtnOriginalHtml = sendBtn.innerHTML;
  sendBtn.disabled = false;
  sendBtn.classList.add('is-stopping');
  sendBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg><span class="ai-send-stop-label">Стоп</span>';
  sendBtn.title = 'Остановить запрос';
  sendBtn.onclick = function () {
    if (_currentStreamAbort) _currentStreamAbort.abort();
    if (window.api && window.api.abortLMStudioStream) window.api.abortLMStudioStream();
  };
  inp.disabled = true;
  _aiRequestInFlight = true;

  const chat = currentChat();
  if (!chat) {
    _aiRequestInFlight = false;
    inp.disabled = false;
    sendBtn.classList.remove('is-stopping');
    return;
  }

  chat.messages.push({ role: 'user', content: text });
  renderMessages();

  var mode = getAIMode();
  var apiOptions = getLMOptions(mode);
  if (mode === 'agent') {
    apiOptions.response_format = AGENT_JSON_RESPONSE_FORMAT;
  }
  var sysContent = (getSystemPrompt() || '').trim();
  if (mode === 'agent') {
    sysContent += '\n\n' + SIRIUS_SYSTEM_INSTRUCTION.trim();
    sysContent += '\n\nФОРМАТ ОТВЕТА В AGENT-РЕЖИМЕ: верни только JSON-объект без markdown: {"assistant_reply":"...","tool_calls":[{"cmd":"READFILE|READDIR|CREATEFILE|EDITFILE|DELETEFILE","arg":"relative/path","body":"string (для READ* и DELETEFILE можно пустую строку)"}]}';
  } else {
    sysContent += '\n\n[РЕЖИМ CHAT] Отвечай кратко и по делу. Не используй файловые команды [CREATEFILE|EDITFILE|READFILE|READDIR|DELETEFILE], только текстовый ответ.';
  }
  var sysMsg = { role: 'system', content: sysContent };

  var contextBlock = await buildContextBlock();
  var lastUserContent = chat.messages[chat.messages.length - 1].content;
  var messagesForApi = chat.messages.slice(0, -1).map(function (m) { return { role: m.role, content: m.content }; });
  messagesForApi.push({
    role: 'user',
    content: contextBlock ? contextBlock + '\n\n---\n\n' + lastUserContent : lastUserContent,
  });

  var apiMessages = [sysMsg].concat(messagesForApi);
  var msgsEl = $('ai-messages');
  var typingEl = document.createElement('div');
  typingEl.className = 'msg msg-assistant';
  typingEl.innerHTML = '<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
  msgsEl.append(typingEl);
  msgsEl.scrollTop = msgsEl.scrollHeight;

  // Update token count for current context
  updateTokenIndicator(apiMessages);

  // Hide placeholder quick actions while generating
  var qaEl = $('ai-placeholder');
  if (qaEl) qaEl.style.display = 'none';

  var fullReply = '';
  var allToolActions = [];
  var execLogEl = null;
  var stepMap = {};  // cmd+arg → stepEl
  var round = 0;
  var userStopped = false;

  function setStreamPhase(phase) {
    var ind = typingEl.querySelector('.typing-indicator, .ai-stream-wrap');
    if (!ind) return;
    var label = ind.querySelector('.ai-phase-label');
    if (!label) {
      label = document.createElement('div');
      label.className = 'ai-phase-label';
      ind.insertBefore(label, ind.firstChild);
    }
    if (phase === 'thinking') {
      label.className = 'ai-phase-label phase-thinking';
      label.textContent = '⟳ Анализирую…';
    } else if (phase === 'writing') {
      label.className = 'ai-phase-label phase-writing';
      label.textContent = '✍ Генерирую ответ';
    } else if (phase === 'executing') {
      label.className = 'ai-phase-label phase-executing';
      label.textContent = '⚙ Выполняю команды';
    } else {
      label.remove();
    }
  }

  function notifyTool(phase, t, idx, total, ok, error) {
    var dot = $('ai-dot');
    if (dot && phase === 'start') dot.className = 'ai-dot loading';

    // Create exec log on first tool
    if (!execLogEl) {
      execLogEl = createExecLog();
      msgsEl.insertBefore(execLogEl, typingEl);
    }

    var stepKey = t.cmd + ':' + t.arg;
    if (phase === 'start') {
      var stepEl = addExecStep(execLogEl, t.cmd, t.arg);
      setExecStepState(stepEl, 'running', '');
      stepMap[stepKey] = stepEl;
    } else if (phase === 'done') {
      var existingStep = stepMap[stepKey];
      if (existingStep) {
        if (ok) setExecStepState(existingStep, 'done', '');
        else setExecStepState(existingStep, 'error', error ? String(error).slice(0, 40) : '');
      }
    }
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  try {
    while (round < MAX_TOOL_ROUNDS) {
      fullReply = '';
      _currentStreamAbort = new AbortController();

      var firstChunk = true;
      await streamToLMStudio(apiMessages, function (chunk) {
        fullReply += chunk;
        if (firstChunk) {
          firstChunk = false;
          // Switch from dots to live text
          typingEl.innerHTML = '<div class="ai-stream-wrap"></div>';
          setStreamPhase('writing');
        }
        var wrap = typingEl.querySelector('.ai-stream-wrap');
        if (wrap) {
          var cleanedSoFar = cleanReply(fullReply);
          if (mode === 'agent' && !cleanedSoFar && looksLikeAgentJson(fullReply)) {
            cleanedSoFar = 'Готовлю изменения...';
          }
          wrap.innerHTML = (wrap.querySelector('.ai-phase-label')
            ? wrap.querySelector('.ai-phase-label').outerHTML : '') +
            '<div class="msg-body">' + renderMarkdownSafe(cleanedSoFar) + '</div>';
        }
        msgsEl.scrollTop = msgsEl.scrollHeight;
      }, _currentStreamAbort ? _currentStreamAbort.signal : undefined, apiOptions);

      // Update token estimate after each round
      updateTokenIndicator(apiMessages.concat([{ role: 'assistant', content: fullReply }]));

      var structured = parseStructuredToolCalls(fullReply);
      var tools = structured ? structured.tools : parseToolCalls(fullReply);
      if (!tools.length) break;

      setStreamPhase('executing');
      var out = await execTools(tools, notifyTool, lastUserContent);
      allToolActions = allToolActions.concat(out.actions || []);
      var toolResultContent = formatToolResultsForModel(out.details || []);

      apiMessages.push({ role: 'assistant', content: fullReply });
      apiMessages.push({ role: 'user', content: toolResultContent });
      round++;

      // Refresh project context between rounds for cyclic awareness
      if (round < MAX_TOOL_ROUNDS) {
        var freshCtx = await buildContextBlock().catch(function() { return ''; });
        if (freshCtx) apiMessages.push({ role: 'user', content: '[CONTEXT_REFRESH]\n' + freshCtx });
      }
    }
  } catch (e) {
    var errMsg = (e && e.message) ? String(e.message) : String(e);
    userStopped = errMsg.indexOf('остановлен') !== -1;
    if (fullReply === '' && !userStopped) fullReply = 'Ошибка подключения к LM Studio: ' + errMsg;
  } finally {
    _currentStreamAbort = null;
    _aiRequestInFlight = false;
    inp.disabled = false;
    sendBtn.disabled = false;
    sendBtn.classList.remove('is-stopping');
    sendBtn.innerHTML = sendBtnOriginalHtml;
    sendBtn.title = 'Отправить (Enter)';
    sendBtn.onclick = sendMessage;
    if (qaEl) qaEl.style.display = '';
  }

  typingEl.remove();
  if (execLogEl && execLogEl.parentNode) execLogEl.parentNode.removeChild(execLogEl);

  var displayReply = cleanReply(fullReply);
  if (mode === 'agent' && (looksLikeAgentJson(fullReply) || looksLikeAgentJson(displayReply))) {
    var finalStructured = parseStructuredToolCalls(fullReply);
    displayReply = finalStructured ? finalStructured.reply : displayReply;
  }
  if (mode === 'agent' && /"assistant_reply"|"tool_calls"/.test(displayReply)) {
    displayReply = '';
  }
  displayReply = stripLeakedToolText(displayReply);
  if (userStopped && displayReply.indexOf('остановлен') === -1) displayReply += '\n\n*Запрос остановлен пользователем.*';

  // Append structured tool action summary
  if (allToolActions.length) {
    var doneList = allToolActions.filter(function (a) { return a.ok; });
    var errList  = allToolActions.filter(function (a) { return !a.ok; });
    var lines = [];
    doneList.forEach(function (a) {
      lines.push('✓ ' + (CMD_LABELS[a.cmd] || a.cmd) + ': **' + a.arg + '**');
    });
    errList.forEach(function (a) {
      lines.push('✗ ' + (CMD_LABELS[a.cmd] || a.cmd) + ' ' + a.arg + ': ' + (a.error || 'ошибка'));
    });
    displayReply += '\n\n---\n**Выполнено:** ' + doneList.length + '/' + allToolActions.length + '\n' + lines.join('\n');
  }
  chat.messages.push({ role: 'assistant', content: displayReply });
  renderMessages();
  saveChats();
  updateTokenIndicator(apiMessages);

  const dotEl = $('ai-dot');
  if (dotEl) dotEl.className = 'ai-dot online';
}

function startLmPoll() {
  fetchModels();
  setInterval(fetchModels, 20000);
  setTimeout(() => {
    updateGitStatus();
    setInterval(updateGitStatus, 30000);
  }, 2000);
}

if (typeof window !== 'undefined') {
  window.getAiOperationJournal = function () {
    try { return JSON.parse(localStorage.getItem('sirius_ai_op_journal_v1') || '[]'); }
    catch (_) { return []; }
  };
  window.clearAiOperationJournal = function () {
    try { localStorage.removeItem('sirius_ai_op_journal_v1'); } catch (_) {}
  };

  // Event delegation for code-block copy buttons (cb-copy)
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.cb-copy');
    if (!btn) return;
    var code = btn.closest('.cb-wrap') && btn.closest('.cb-wrap').querySelector('code');
    if (!code) return;
    var text = code.textContent || '';
    var copyIconSvg = decodeURIComponent(btn.dataset.copyIcon || '');
    var doneIconSvg  = decodeURIComponent(btn.dataset.doneIcon  || '');
    navigator.clipboard.writeText(text).then(function () {
      btn.classList.add('cb-copy-done');
      if (doneIconSvg) btn.innerHTML = doneIconSvg + ' \u0421\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u043e';
      setTimeout(function () {
        btn.classList.remove('cb-copy-done');
        if (copyIconSvg) btn.innerHTML = copyIconSvg + ' \u041a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c';
      }, 2200);
    }).catch(function () {
      if (typeof toast === 'function') toast('\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c', 'error', 1500);
    });
  });
}
