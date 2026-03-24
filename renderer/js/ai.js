/* Sirius IDE — ai.js */
'use strict';

let chats = [];
let currentChatId = null;
const LM_URL = 'http://127.0.0.1:1234/v1'; // fallback при отсутствии прокси (CORS может блокировать)

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
    tab.innerHTML = `<span>${c.name}</span><button class="chat-tab-close" title="Удалить">✕</button>`;
    tab.addEventListener('click', ev => { if (!ev.target.closest('.chat-tab-close')) switchChat(c.id); });
    tab.querySelector('span').addEventListener('dblclick', () => openRenameChatModal(c.id));
    tab.querySelector('.chat-tab-close').addEventListener('click', ev => { ev.stopPropagation(); deleteChat(c.id); });
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

function md(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="lang-$1">$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br/>');
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
    <div class="msg-body${isLong ? ' collapsed' : ''}">${md(content)}</div>
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
    $('model-name').textContent = model || '—';
    $('ai-dot').className = 'ai-dot online';
    $('sb-dot').className = 'sb-dot online';
    $('sb-lm').title = 'LM Studio: ' + (model || 'подключено');
  };
  const setOffline = () => {
    $('model-name').textContent = 'LM Studio недоступен';
    $('ai-dot').className = 'ai-dot';
    $('sb-dot').className = 'sb-dot';
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

function cleanReply(text) {
  const re = new RegExp('\\[(' + TOOL_NAMES + '):[^\\]]*\\][\\s\\S]*?(?=\\[(?:' + TOOL_NAMES + '):|$)', 'g');
  return text.replace(re, '').trim();
}

var CMD_LABELS = {
  CREATEFILE: 'Создан файл',
  EDITFILE: 'Изменён файл',
  READFILE: 'Прочитан файл',
  READDIR: 'Содержимое директории',
  DELETEFILE: 'Удалён файл',
};

async function execTools(tools, onToolProgress) {
  const results = [];
  const actions = [];
  const details = [];
  const notify = (phase, t, idx, total, ok, error) => {
    if (typeof onToolProgress !== 'function') return;
    try { onToolProgress(phase, t, idx, total, ok, error); } catch (_) {}
  };
  var list = Array.isArray(tools) ? tools.slice(0, MAX_TOOL_CALLS_PER_REPLY) : [];
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
        const originalContent = openFiles[fullPath]?.content || '';
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
        toast(t.cmd === 'CREATEFILE' ? 'Создан: ' + t.arg : 'Изменён: ' + t.arg, 'success');
      } else if (t.cmd === 'DELETEFILE') {
        await window.api.delete(fullPath);
        if (openFiles[fullPath]) {
          if (activeFile === fullPath) closeTab(fullPath);
          else delete openFiles[fullPath];
          if (openFilesOrder) openFilesOrder = openFilesOrder.filter(function (p) { return p !== fullPath; });
        }
        refreshTree();
        results.push(`DELETEFILE ${t.arg}: OK`);
        actions.push({ cmd: t.cmd, arg: t.arg, ok: true });
        details.push({ cmd: t.cmd, arg: t.arg, ok: true });
        toast('Удалён: ' + t.arg, 'success');
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
  return '<environment>\n<project_root>' + root + '</project_root>\n<project_name>' + (name || '') + '</project_name>\n<project_tree>\n' + (tree || '(empty)') + '</project_tree>' + currentFileBlock + '\n</environment>';
}

// Системный промпт: инструменты, контекст, самопроверка, планирование
var SIRIUS_SYSTEM_INSTRUCTION = `
ТЫ — SIRIUS IDE ASSISTANT. ТВОЯ ЦЕЛЬ: ТОЧНЫЙ РЕЗУЛЬТАТ БЕЗ ЛИШНИХ ДЕЙСТВИЙ.

========================
1) РОЛЬ И ПРИОРИТЕТЫ
========================
1. Выполняй намерение пользователя, а не формулировку буквально.
2. Сначала корректность, потом краткость, потом стиль.
3. Если запрос про файлы — делай действие через команды, а не советами.
   Если пользователь просит "изменить/исправить/обновить/дополнить код" в конкретном файле (или "в этом текущем файле") — конечный результат обязан быть ТОЛЬКО через EDITFILE (или CREATEFILE для несуществующего файла).
   Нельзя отвечать описанием того, "что нужно сделать" — надо выполнить правку командами и выдать полный итоговый текст файла.
4. Не выдумывай факты о проекте: опирайся только на <environment> и <tool_results>.

========================
2) ДОСТУПНЫЕ КОМАНДЫ
========================
Разрешены только 5 команд:
[CREATEFILE:path]
[EDITFILE:path]
[READFILE:path]
[READDIR:path]
[DELETEFILE:path]

Правило: любое файловое действие (создать/изменить/прочитать/удалить/получить список) — только этими командами.

========================
3) РЕЖИМЫ ОТВЕТА (СТРОГО)
========================
Выбирай ровно один режим на каждый ответ:

РЕЖИМ A — "COMMANDS ONLY"
- Если нужно выполнить файловые действия.
- Ответ содержит только команды (и тело файла для CREATEFILE/EDITFILE).
- Никаких пояснений до/после команд.

РЕЖИМ B — "TEXT ONLY"
- Если пользователь просит объяснение, идею, оценку, или файловые действия не нужны.
- Ответ только текстом, без команд.

Запрещено смешивать режимы в одном сообщении.

========================
4) ФОРМАТ КОМАНД
========================
Для CREATEFILE/EDITFILE:
- Первая строка: [CREATEFILE:path] или [EDITFILE:path]
- Начиная со следующей строки: полный финальный текст файла.
- Только сырой текст файла. Нельзя использовать markdown-блоки, подписи, комментарии "ниже код".
  
Для READFILE/READDIR/DELETEFILE:
- Одна строка-команда, без тела.

Пример:
[EDITFILE:src/app.js]
const x = 1;
module.exports = { x };

========================
5) ПРАВИЛА ПУТЕЙ
========================
1. Пути только относительные от <project_root>.
2. Запрещены: абсолютные пути, ./, ../, обратные слеши в начале.
3. В имени файла/папки допускаются любые символы (включая кириллицу). Не пытайся транслитерировать.
4. Если путь неочевиден — сначала [READDIR:папка], затем действие.

========================
6) ОБЯЗАТЕЛЬНОЕ ИСПОЛЬЗОВАНИЕ КОНТЕКСТА
========================
В начале пользовательского сообщения есть <environment>:
- <project_root>: корень проекта.
- <project_tree>: актуальная структура файлов.
- <current_file path="..." language="...">: текущий файл и его содержимое.

Обязательные правила:
1. "этот/текущий файл" => используй path из <current_file>.
2. Не создавай путь, которого нет в структуре, без предварительной проверки через READDIR.
3. Для изменения файла используй актуальное содержимое из <current_file> или <tool_results>.

========================
7) АЛГОРИТМ РЕШЕНИЯ
========================
Шаг 1: Определи тип запроса:
- файловое действие => РЕЖИМ A
- не файловое => РЕЖИМ B
Дополнение к Шагу 1:
Если запрос содержит правку кода (слова: "изменить", "правь", "исправь", "обнови", "добавь", "замени", "перепиши", "сделай так", "в файле") — это файловое действие => РЕЖИМ A.

Шаг 2: Если данных недостаточно для безопасного изменения:
- сначала READFILE/READDIR, не делай предположений.

Шаг 3: После получения <tool_results>:
- выполни следующий логический шаг,
- дойди до конечного результата без лишних промежуточных действий.

========================
8) КАЧЕСТВО И ТОЧНОСТЬ
========================
1. В EDITFILE/CREATEFILE всегда отдавай целостный финальный вариант файла.
2. Не сокращай критические части файла троеточиями.
3. Не ломай существующий функционал без прямого запроса.
4. Если пользователь просит изменить файл (и путь известен из <current_file> или явно указан) — в финальном шаге используй EDITFILE/CREATEFILE и передай полный исходник файла.
   Модель не должна завершать ответ одним лишь описанием изменений — только командами (РЕЖИМ A) и итоговым текстом файла.
4. Если в запросе есть неоднозначность, мешающая безопасному действию:
   - в РЕЖИМЕ B задай 1 короткий уточняющий вопрос.
   - если можно безопасно продолжить частично — сначала выполни безопасный шаг (обычно READFILE/READDIR).

========================
9) ПЕРЕД ОТПРАВКОЙ (САМООЦЕНКА)
========================
Проверь молча:
1. Я выбрал правильный режим (A или B)?
2. Если режим A: есть только команды, формат команд валиден?
3. Пути корректны и согласованы с <project_tree>/<current_file>?
4. Для EDITFILE/CREATEFILE после ] идёт только сырой текст файла?
5. Ответ действительно решает задачу пользователя, а не описывает намерение?

========================
10) ЯЗЫК И СТИЛЬ
========================
1. Пиши на языке пользователя.
2. Будь конкретным и проверяемым.
3. Не добавляй лишнюю "воду".
`;

var MAX_TOOL_ROUNDS = 3;

async function sendMessage() {
  const inp = $('ai-input');
  const text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  inp.style.height = 'auto';
  var sendBtn = $('ai-send');
  var sendBtnOriginalHtml = sendBtn.innerHTML;
  sendBtn.disabled = false;
  sendBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg><span class="ai-send-stop-label">Стоп</span>';
  sendBtn.title = 'Остановить запрос';
  sendBtn.onclick = function () {
    if (_currentStreamAbort) _currentStreamAbort.abort();
    if (window.api && window.api.abortLMStudioStream) window.api.abortLMStudioStream();
  };

  const chat = currentChat();
  if (!chat) return;

  chat.messages.push({ role: 'user', content: text });
  renderMessages();

  var mode = getAIMode();
  var apiOptions = getLMOptions(mode);
  var sysContent = (getSystemPrompt() || '').trim();
  if (mode === 'agent') {
    sysContent += '\n\n' + SIRIUS_SYSTEM_INSTRUCTION.trim();
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
  typingEl.className = 'msg assistant';
  typingEl.innerHTML = '<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
  msgsEl.append(typingEl);
  msgsEl.scrollTop = msgsEl.scrollHeight;

  var fullReply = '';
  var allToolActions = [];
  var round = 0;
  var userStopped = false;
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  function setToolsBusy(phase, t, idx, total, ok, error) {
    const indicator = typingEl.querySelector('.typing-indicator');
    if (!indicator) return;
    const dot = $('ai-dot');
    if (dot && phase === 'start') dot.className = 'ai-dot loading';
    const label = CMD_LABELS[t.cmd] || t.cmd;
    const doneIndex = phase === 'done' ? (idx + 1) : idx;
    const pct = total ? Math.max(0, Math.min(100, Math.round((doneIndex / total) * 100))) : 0;
    const statusPart = phase === 'done' ? (ok ? 'OK' : 'ERROR') : '...';
    indicator.innerHTML = `
      <div class="ai-tools-spinner" aria-hidden="true"></div>
      <div class="ai-tools-busy-text">
        <div class="ai-tools-busy-title">${phase === 'done' ? 'Команда выполнена' : 'Выполняю файлы'}</div>
        <div class="ai-tools-busy-sub">
          <span class="ai-tools-busy-cmd">${escapeHtml(label)}</span>:
          <span class="ai-tools-busy-arg">${escapeHtml(t.arg)}</span>
          <span style="opacity:.7"> ${statusPart}</span>
        </div>
        <div class="ai-tools-progress"><div class="ai-tools-progress-bar" style="width:${pct}%" ></div></div>
      </div>
    `;
  }

  try {
    while (round < MAX_TOOL_ROUNDS) {
      fullReply = '';
      _currentStreamAbort = new AbortController();
      await streamToLMStudio(apiMessages, function (chunk) {
        fullReply += chunk;
        var el = typingEl.querySelector('.typing-indicator');
        if (el) el.innerHTML = '<div class="msg-body">' + md(cleanReply(fullReply)) + '</div>';
        msgsEl.scrollTop = msgsEl.scrollHeight;
      }, _currentStreamAbort ? _currentStreamAbort.signal : undefined, apiOptions);

      var tools = parseToolCalls(fullReply);
      if (!tools.length) break;

      // Ensure the UI visibly switches to "tool execution" before tools run.
      // Tool writes can be very fast, so relying only on callback may be too subtle.
      setToolsBusy('start', tools[0], 0, tools.length, true, null);
      var out = await execTools(tools, function (phase, t, idx, total, ok, error) {
        setToolsBusy(phase, t, idx, total, ok, error);
      });
      allToolActions = allToolActions.concat(out.actions || []);
      var toolResultContent = formatToolResultsForModel(out.details || []);

      apiMessages.push({ role: 'assistant', content: fullReply });
      apiMessages.push({ role: 'user', content: toolResultContent });
      round++;
    }
  } catch (e) {
    var errMsg = (e && e.message) ? String(e.message) : String(e);
    userStopped = errMsg.indexOf('остановлен') !== -1;
    if (fullReply === '' && !userStopped) fullReply = 'Ошибка подключения к LM Studio: ' + errMsg;
  } finally {
    _currentStreamAbort = null;
    sendBtn.disabled = false;
    sendBtn.innerHTML = sendBtnOriginalHtml;
    sendBtn.title = 'Отправить (Enter)';
    sendBtn.onclick = sendMessage;
  }

  typingEl.remove();

  var displayReply = cleanReply(fullReply);
  if (userStopped && displayReply.indexOf('остановлен') === -1) displayReply += '\n\n*Запрос остановлен пользователем.*';

  if (allToolActions.length) {
    var lines = [];
    for (var i = 0; i < allToolActions.length; i++) {
      var a = allToolActions[i];
      var label = CMD_LABELS[a.cmd] || a.cmd;
      if (a.ok) lines.push('• ' + label + ': **' + a.arg + '**');
      else lines.push('• ' + label + ' ' + a.arg + ': ошибка — ' + (a.error || ''));
    }
    displayReply += '\n\n---\n**Выполненные действия:**\n' + lines.join('\n');
  }
  chat.messages.push({ role: 'assistant', content: displayReply });
  renderMessages();
  saveChats();

  $('ai-dot').className = 'ai-dot online';
}

function startLmPoll() {
  fetchModels();
  setInterval(fetchModels, 20000);
  setTimeout(() => {
    updateGitStatus();
    setInterval(updateGitStatus, 30000);
  }, 2000);
}
