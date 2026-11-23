/* Sirius IDE — ai.js */
'use strict';

let chats = [];
let currentChatId = null;
let _aiRequestInFlight = false;

function getActiveLLMConfig() {
  var s = typeof getLLMSettings === 'function' ? getLLMSettings() : { providerId: 'lmstudio', baseUrl: 'http://127.0.0.1:1234/v1', apiKey: '', model: '' };
  var baseUrl = typeof resolveLLMBaseUrl === 'function' ? resolveLLMBaseUrl(s) : String(s.baseUrl || 'http://127.0.0.1:1234/v1');
  return {
    providerId: s.providerId || 'lmstudio',
    baseUrl: baseUrl,
    apiKey: String(s.apiKey || ''),
    model: String(s.model || ''),
  };
}

function providerDisplayName(providerId) {
  return typeof getLLMProviderLabel === 'function' ? getLLMProviderLabel(providerId) : (providerId || 'LLM');
}

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

function createNewChat() {
  const c = { id: uid(), name: `Чат ${chats.length + 1}`, messages: [], agent: null };
  chats.push(c);
  switchChat(c.id);
  saveChats();
}

function switchChat(id) {
  currentChatId = id;
  renderChatTabs();
  renderMessages();
  renderAgentSessionBar();
}

function deleteChat(id) {
  if (chats.length <= 1) { toast('Нельзя удалить последний чат', 'info'); return; }
  chats = chats.filter(c => c.id !== id);
  if (currentChatId === id) currentChatId = chats[chats.length - 1].id;
  renderChatTabs();
  renderMessages();
  renderAgentSessionBar();
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

function buildEmptyChatHtml() {
  // Single source — keep in sync with #ai-placeholder in index.html
  return ''
    + '<div class="ai-placeholder ai-empty-state" id="ai-placeholder">'
    + '<div class="ai-empty-mark" aria-hidden="true"><img src="assets/sirius-mark.svg" width="40" height="40" alt="" /></div>'
    + '<p class="ai-empty-brand">Sirius</p>'
    + '<p class="ai-empty-sub">Локальный агент. Пиши задачу — правки уйдут в файлы проекта.</p>'
    + '<div class="ai-quick-actions ai-empty-actions" id="ai-quick-actions">'
    + '<div class="ai-qa-row">'
    + '<button type="button" class="ai-qa-btn" data-prompt="Проверь проект на ошибки и уязвимости">Ошибки</button>'
    + '<button type="button" class="ai-qa-btn" data-prompt="Напиши тесты для текущего файла">Тесты</button>'
    + '<button type="button" class="ai-qa-btn" data-prompt="Проведи код-ревью текущего файла: архитектура, стиль, потенциальные баги">Ревью</button>'
    + '<button type="button" class="ai-qa-btn" data-prompt="Объясни структуру проекта и как взаимодействуют основные компоненты">Карта</button>'
    + '</div></div></div>';
}

function formatMsgTime(d) {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(d || new Date());
  } catch (_) {
    return '';
  }
}

function renderMessages(animateLast) {
  const container = $('ai-messages');
  const chat = currentChat();
  container.innerHTML = '';
  if (!chat || !chat.messages.length) {
    container.innerHTML = buildEmptyChatHtml();
    bindQuickActionButtons(container);
    return;
  }
  const lastIdx = chat.messages.length - 1;
  for (let i = 0; i < chat.messages.length; i++) {
    const m = chat.messages[i];
    appendMessage(m.role, m.content, container, false, {
      animate: !!animateLast && i === lastIdx,
      showTime: true,
    });
  }
  container.scrollTop = container.scrollHeight;
}

function bindQuickActionButtons(root) {
  var scope = root || document;
  scope.querySelectorAll('.ai-qa-btn').forEach(function (btn) {
    if (btn.dataset.boundQa) return;
    btn.dataset.boundQa = '1';
    btn.addEventListener('click', function () {
      var prompt = btn.getAttribute('data-prompt') || '';
      var inp = $('ai-input');
      if (!inp || !prompt) return;
      inp.value = prompt;
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.focus();
    });
  });
}

/* Don't auto-collapse — selecting / reading text must not fight a fold */
const COLLAPSE_THRESHOLD = 12000;

function appendMessage(role, content, container, scroll, opts) {
  if (scroll === undefined) scroll = true;
  opts = opts || {};
  const div = document.createElement('div');
  div.className = 'msg msg-' + role + (opts.animate ? ' msg-enter' : '');
  const isLong = content.length > COLLAPSE_THRESHOLD;
  const roleLabel = role === 'user' ? 'Вы' : 'Агент';
  const ts = formatMsgTime(new Date());
  const timeHtml = opts.showTime !== false && ts
    ? '<time class="msg-time" datetime="' + new Date().toISOString() + '">' + ts + '</time>'
    : '';
  var copyIcon = '<svg class="msg-copy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  var checkIcon = '<svg class="msg-copy-icon msg-copy-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  div.innerHTML = `
    <div class="msg-header">
      <span class="msg-role">${roleLabel}</span>
      ${timeHtml}
      <button type="button" class="msg-copy" title="Копировать">${copyIcon}</button>
    </div>
    <div class="msg-body">${renderMarkdownSafe(content)}</div>
    ${isLong ? '<button type="button" class="msg-toggle">Свернуть ▲</button>' : ''}
  `;
  var copyBtn = div.querySelector('.msg-copy');
  if (copyBtn) {
    copyBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
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
    btn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      var collapsed = body.classList.toggle('collapsed');
      btn.textContent = collapsed ? 'Показать полностью ▼' : 'Свернуть ▲';
    });
  }
  container.append(div);
  if (scroll) container.scrollTop = container.scrollHeight;
  return div;
}

function parseModelListFromApiResponse(data) {
  if (!data || typeof data !== 'object') return [];
  const list = data.data ?? data.models ?? (Array.isArray(data) ? data : null);
  if (!Array.isArray(list)) return [];
  return list
    .map(function (item) {
      if (typeof item === 'string') return item;
      return item.id ?? item.name ?? '';
    })
    .filter(Boolean);
}

function parseModelFromApiResponse(data) {
  const list = parseModelListFromApiResponse(data);
  return list.length ? list[0] : null;
}

function syncModelSelectOptions(ids, selected) {
  var sel = document.getElementById('ai-model');
  if (!sel) return selected || '';
  var prev = selected || sel.value || '';
  sel.innerHTML = '';
  sel.disabled = !ids.length;
  if (!ids.length) {
    var empty = document.createElement('option');
    empty.value = '';
    empty.textContent = '— нет моделей —';
    sel.appendChild(empty);
    return '';
  }
  ids.forEach(function (id) {
    var opt = document.createElement('option');
    opt.value = id;
    opt.textContent = id;
    sel.appendChild(opt);
  });
  var pick = prev && ids.indexOf(prev) !== -1 ? prev : ids[0];
  sel.value = pick;
  if (typeof saveLLMSettings === 'function') saveLLMSettings({ model: pick });
  return pick;
}

async function fetchModels() {
  const cfg = getActiveLLMConfig();
  const provName = providerDisplayName(cfg.providerId);

  const setOnline = (model) => {
    const nameEl = $('model-name');
    const short = model || 'подключено';
    const label = provName + ': ' + short;
    if (nameEl) { nameEl.textContent = label; nameEl.title = label; }
    const statusEl = $('ai-status');
    if (statusEl) {
      statusEl.textContent = 'Подключено';
      statusEl.className = 'ai-status ai-status-online';
      statusEl.title = label;
    }
    const aiDot = $('ai-dot');
    if (aiDot) aiDot.className = 'ai-dot online';
    const sbDot = $('sb-dot');
    if (sbDot) sbDot.className = 'sb-dot online';
    const sbLm = $('sb-lm');
    if (sbLm) {
      sbLm.title = label;
      var textNodes = Array.prototype.filter.call(sbLm.childNodes, function (n) { return n.nodeType === 3; });
      if (textNodes.length) textNodes[0].textContent = ' ' + provName;
    }
  };
  const setOffline = () => {
    const nameEl = $('model-name');
    if (nameEl) {
      nameEl.textContent = provName + ': офлайн';
      nameEl.title = 'Проверьте, что ' + provName + ' запущен (' + cfg.baseUrl + ')';
    }
    const statusEl = $('ai-status');
    if (statusEl) {
      statusEl.textContent = 'Офлайн';
      statusEl.className = 'ai-status ai-status-offline';
      statusEl.title = 'Нет подключения к ' + provName;
    }
    const aiDot = $('ai-dot');
    if (aiDot) aiDot.className = 'ai-dot';
    const sbDot = $('sb-dot');
    if (sbDot) sbDot.className = 'sb-dot';
  };

  try {
    var data = null;
    if (window.api?.getLLMModels) {
      data = await window.api.getLLMModels({
        baseUrl: cfg.baseUrl,
        apiKey: cfg.apiKey,
        providerId: cfg.providerId,
      });
    } else if (window.api?.getLMStudioModels) {
      data = await window.api.getLMStudioModels();
    } else {
      var headers = { 'Content-Type': 'application/json' };
      if (cfg.apiKey) headers.Authorization = 'Bearer ' + cfg.apiKey;
      const r = await fetch(cfg.baseUrl + '/models', { headers: headers });
      data = await r.json();
    }
    const ids = parseModelListFromApiResponse(data);
    const model = syncModelSelectOptions(ids, cfg.model) || parseModelFromApiResponse(data);
    if (model || ids.length) setOnline(model || ids[0]); else setOffline();
  } catch (_) {
    setOffline();
  }
}

function applyProviderSelectUi(settings) {
  var provSel = document.getElementById('ai-provider');
  var baseInp = document.getElementById('ai-base-url');
  var apiKey = document.getElementById('ai-api-key');
  var s = settings || (typeof getLLMSettings === 'function' ? getLLMSettings() : {});
  if (provSel && s.providerId) provSel.value = s.providerId;
  // Base URL always visible — user can paste any OpenAI-compatible endpoint
  if (baseInp) {
    baseInp.disabled = false;
    var shown = '';
    try {
      shown = (typeof resolveLLMBaseUrl === 'function') ? resolveLLMBaseUrl(s) : (s.baseUrl || '');
    } catch (_) {
      shown = s.baseUrl || '';
    }
    if (document.activeElement !== baseInp) baseInp.value = shown || '';
  }
  if (apiKey && document.activeElement !== apiKey) {
    apiKey.value = s.apiKey || '';
  }
}

function commitBaseUrlFromInput(raw) {
  var url = String(raw || '').trim();
  if (!url) return null;
  var patch = { baseUrl: url };
  var inferred = typeof inferProviderFromBaseUrl === 'function' ? inferProviderFromBaseUrl(url) : null;
  if (inferred) patch.providerId = inferred;
  else patch.providerId = 'custom';
  if (typeof saveLLMSettings === 'function') saveLLMSettings(patch);
  var next = typeof getLLMSettings === 'function' ? getLLMSettings() : patch;
  applyProviderSelectUi(next);
  var status = document.getElementById('ai-status');
  if (status) {
    status.textContent = 'URL сохранён';
    status.className = 'ai-status ai-status-online';
    setTimeout(function () {
      if (status.textContent === 'URL сохранён') status.textContent = '';
    }, 1800);
  }
  if (typeof toast === 'function') toast('API URL: ' + (typeof resolveLLMBaseUrl === 'function' ? resolveLLMBaseUrl(next) : url), 'success', 2200);
  return next;
}

function setAiSettingsMenuOpen(open) {
  var menu = document.getElementById('ai-settings-menu');
  var btn = document.getElementById('ai-settings-btn');
  var chip = document.getElementById('ai-model-chip');
  if (!menu) return;
  menu.hidden = !open;
  if (btn) btn.classList.toggle('active', !!open);
  if (chip) chip.classList.toggle('open', !!open);
}

function initLLMProviderPanel() {
  var bar = document.getElementById('ai-model-bar');
  if (!bar || bar.dataset.llmInit === '1') return;
  bar.dataset.llmInit = '1';

  var settings = typeof getLLMSettings === 'function' ? getLLMSettings() : {};
  var menu = document.getElementById('ai-settings-menu');
  var settingsBtn = document.getElementById('ai-settings-btn');
  var chip = document.getElementById('ai-model-chip');

  function toggleMenu(ev) {
    if (ev) ev.stopPropagation();
    var open = menu && menu.hidden;
    setAiSettingsMenuOpen(!!open);
  }
  if (settingsBtn) settingsBtn.addEventListener('click', toggleMenu);
  if (chip) chip.addEventListener('click', toggleMenu);
  if (menu) {
    menu.addEventListener('click', function (ev) { ev.stopPropagation(); });
    menu.addEventListener('mousedown', function (ev) { ev.stopPropagation(); });
  }
  document.addEventListener('click', function (ev) {
    if (!menu || menu.hidden) return;
    if (bar.contains(ev.target)) return;
    setAiSettingsMenuOpen(false);
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') setAiSettingsMenuOpen(false);
  });

  var provSel = document.getElementById('ai-provider');
  if (provSel) {
    provSel.innerHTML = '';
    Object.keys(LLM_PROVIDER_PRESETS || {}).forEach(function (key) {
      var p = LLM_PROVIDER_PRESETS[key];
      var opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.label;
      provSel.appendChild(opt);
    });
    provSel.value = settings.providerId || 'lmstudio';
    provSel.addEventListener('change', function () {
      var id = provSel.value;
      var patch = { providerId: id };
      if (id !== 'custom' && LLM_PROVIDER_PRESETS[id]) patch.baseUrl = LLM_PROVIDER_PRESETS[id].baseUrl;
      if (typeof saveLLMSettings === 'function') saveLLMSettings(patch);
      applyProviderSelectUi(typeof getLLMSettings === 'function' ? getLLMSettings() : patch);
      fetchModels();
    });
  }

  var baseInp = document.getElementById('ai-base-url');
  if (baseInp) {
    var saveUrl = function () {
      if (!baseInp.value.trim()) return;
      commitBaseUrlFromInput(baseInp.value);
      fetchModels();
    };
    baseInp.addEventListener('change', saveUrl);
    baseInp.addEventListener('blur', saveUrl);
    baseInp.addEventListener('paste', function () {
      setTimeout(saveUrl, 0);
    });
    baseInp.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); saveUrl(); }
    });
  }

  var modelSel = document.getElementById('ai-model');
  if (modelSel) {
    modelSel.addEventListener('change', function () {
      if (typeof saveLLMSettings === 'function') saveLLMSettings({ model: modelSel.value });
      setAiSettingsMenuOpen(false);
    });
  }

  var apiKey = document.getElementById('ai-api-key');
  if (apiKey) {
    apiKey.value = settings.apiKey || '';
    apiKey.addEventListener('change', function () {
      if (typeof saveLLMSettings === 'function') saveLLMSettings({ apiKey: apiKey.value });
      fetchModels();
    });
  }

  var refreshBtn = document.getElementById('ai-llm-refresh');
  if (refreshBtn) refreshBtn.addEventListener('click', function (ev) {
    ev.stopPropagation();
    fetchModels();
  });

  applyProviderSelectUi(settings);

  var mode = settings.aiMode || 'agent';
  var agentEl = document.getElementById('ai-mode-agent');
  var chatEl = document.getElementById('ai-mode-chat');
  if (mode === 'chat' && chatEl) chatEl.checked = true;
  else if (agentEl) agentEl.checked = true;
  document.querySelectorAll('input[name="ai-mode"]').forEach(function (el) {
    el.addEventListener('change', function () {
      if (typeof saveLLMSettings === 'function') saveLLMSettings({ aiMode: getAIMode() });
    });
  });
}

var _currentStreamAbort = null;

var DEFAULT_TEMPERATURE = 0.2;
/* Agent needs headroom for full-file EDITFILE bodies */
var MAX_TOKENS_CHAT = 4096;
var MAX_TOKENS_AGENT = 16384;
var MAX_TOKENS = MAX_TOKENS_AGENT;
var AGENT_TEMPERATURE = 0.05;
var AGENT_SEED = 42;

function getAIMode() {
  try {
    var chatEl = document.getElementById('ai-mode-chat');
    if (chatEl && chatEl.checked) return 'chat';
  } catch (_) {}
  return 'agent';
}

function getLMOptions(mode) {
  var temperature = DEFAULT_TEMPERATURE;
  var maxTokens = MAX_TOKENS_AGENT;
  var opts = { temperature: temperature, max_tokens: maxTokens };
  try {
    if (mode === 'chat') {
      opts.temperature = 0.4;
      opts.max_tokens = MAX_TOKENS_CHAT;
    } else {
      opts.temperature = AGENT_TEMPERATURE;
      opts.max_tokens = MAX_TOKENS_AGENT;
      opts.top_p = 0.9;
      opts.seed = AGENT_SEED;
    }
  } catch (_) {}
  MAX_TOKENS = opts.max_tokens;
  return opts;
}

function hasActionIntent(userText) {
  var t = String(userText || '').toLowerCase();
  return /создай|создать|измени|изменить|исправ|добав|удали|перепиши|сделай|реализ|перенес|очист|отрефактор|улучш|граф|оболоч|gui|интерфейс|окно|добавь|сделать|почини|переимен|delete|remove|create|edit|fix|update|implement|refactor|write|generate|improve|ui/.test(t);
}

function toolsAreReadOnly(tools) {
  if (!tools || !tools.length) return true;
  return tools.every(function (t) {
    return t && (t.cmd === 'READFILE' || t.cmd === 'READDIR');
  });
}

function toolsHaveWrites(tools) {
  if (!tools || !tools.length) return false;
  return tools.some(function (t) {
    return t && (t.cmd === 'CREATEFILE' || t.cmd === 'EDITFILE' || t.cmd === 'DELETEFILE');
  });
}

function actionsHaveWrites(actions) {
  if (!actions || !actions.length) return false;
  return actions.some(function (a) {
    return a && a.ok && (a.cmd === 'CREATEFILE' || a.cmd === 'EDITFILE' || a.cmd === 'DELETEFILE');
  });
}

function streamToLLM(messages, onChunk, signal, options) {
  var cfg = getActiveLLMConfig();
  var payload = {
    baseUrl: cfg.baseUrl,
    apiKey: cfg.apiKey,
    model: cfg.model,
    messages: messages,
    temperature: (options && options.temperature) ?? DEFAULT_TEMPERATURE,
    max_tokens: (options && options.max_tokens) ?? MAX_TOKENS,
  };
  if (options && options.response_format) payload.response_format = options.response_format;
  if (options && typeof options.top_p === 'number') payload.top_p = options.top_p;
  if (options && typeof options.seed === 'number') payload.seed = options.seed;

  if (window.api?.streamLLMChat && window.api?.onLLMChunk && window.api?.onLLMStreamEnd && window.api?.onLLMStreamError) {
    return new Promise((resolve, reject) => {
      const unChunk = window.api.onLLMChunk(onChunk);
      const unEnd = window.api.onLLMStreamEnd(() => { unChunk(); unEnd(); unErr(); resolve(); });
      const unErr = window.api.onLLMStreamError((err) => { unChunk(); unEnd(); unErr(); reject(new Error(err)); });
      window.api.streamLLMChat(payload);
    });
  }
  if (window.api?.streamLMStudioChat && window.api?.onLMStudioChunk && window.api?.onLMStudioStreamEnd && window.api?.onLMStudioStreamError) {
    var legacy = { messages: messages, temperature: payload.temperature, max_tokens: payload.max_tokens };
    if (payload.response_format) legacy.response_format = payload.response_format;
    return new Promise((resolve, reject) => {
      const unChunk = window.api.onLMStudioChunk(onChunk);
      const unEnd = window.api.onLMStudioStreamEnd(() => { unChunk(); unEnd(); unErr(); resolve(); });
      const unErr = window.api.onLMStudioStreamError((err) => { unChunk(); unEnd(); unErr(); reject(new Error(err)); });
      window.api.streamLMStudioChat(legacy);
    });
  }
  return streamToLLMFallback(messages, onChunk, signal, options, cfg);
}

async function streamToLLMFallback(messages, onChunk, signal, options, cfg) {
  var headers = { 'Content-Type': 'application/json' };
  if (cfg && cfg.apiKey) headers.Authorization = 'Bearer ' + cfg.apiKey;
  var body = {
    model: (cfg && cfg.model) || '',
    messages,
    stream: true,
    temperature: (options && options.temperature) ?? DEFAULT_TEMPERATURE,
    max_tokens: (options && options.max_tokens) ?? MAX_TOKENS,
  };
  if (options && options.response_format) body.response_format = options.response_format;
  if (options && typeof options.top_p === 'number') body.top_p = options.top_p;
  if (options && typeof options.seed === 'number') body.seed = options.seed;

  const resp = await fetch((cfg && cfg.baseUrl ? cfg.baseUrl : 'http://127.0.0.1:1234/v1') + '/chat/completions', {
    signal: signal || undefined,
    method: 'POST',
    headers: headers,
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

var _treeCache = { root: '', text: '', at: 0 };
var TREE_CACHE_MS = 45000;
var TREE_SKIP = { node_modules: 1, dist: 1, release: 1, coverage: 1, '.git': 1, '.cache': 1, '.sirius': 1, out: 1 };

function invalidateProjectTreeCache() {
  _treeCache = { root: '', text: '', at: 0 };
}

async function buildProjectTree(dir, depth, maxDepth) {
  if (depth > maxDepth) return '';
  let entries;
  try { entries = await window.api.readDir(dir); } catch (_) { return ''; }
  entries = (entries || []).filter(function (e) {
    if (!e || !e.name) return false;
    if (e.name.startsWith('.')) return false;
    if (TREE_SKIP[e.name]) return false;
    return true;
  });
  // Cap breadth so huge folders don't stall the agent
  if (entries.length > 80) entries = entries.slice(0, 80);

  var lines = [];
  var dirs = [];
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    lines.push('  '.repeat(depth) + (e.isDirectory ? 'd ' : 'f ') + e.name);
    if (e.isDirectory && depth < maxDepth) dirs.push(e.path);
  }

  if (dirs.length) {
    var kids = await Promise.all(dirs.map(function (p) {
      return buildProjectTree(p, depth + 1, maxDepth);
    }));
    for (var k = 0; k < kids.length; k++) {
      if (kids[k]) lines.push(kids[k].replace(/\n$/, ''));
    }
  }
  return lines.filter(Boolean).join('\n') + (lines.length ? '\n' : '');
}

async function getCachedProjectTree(root, maxDepth) {
  var now = Date.now();
  if (_treeCache.root === root && _treeCache.text && (now - _treeCache.at) < TREE_CACHE_MS) {
    return _treeCache.text;
  }
  var text = await buildProjectTree(root, 0, maxDepth);
  _treeCache = { root: root, text: text, at: now };
  return text;
}

async function getProjectContextBlock() {
  if (!projectRoot) return '';
  try {
    const tree = await getCachedProjectTree(projectRoot, 2);
    const name = projectRoot.split(/[\\/]/).pop();
    return `\n\nProject "${name}" (${projectRoot}):\n${tree || '(empty)'}`;
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
var TOOL_STEP_KIND = {
  CREATEFILE: 'create',
  EDITFILE: 'edit',
  READFILE: 'read',
  READDIR: 'list',
  DELETEFILE: 'delete',
};

function toolStepLabel(cmd) {
  var kind = TOOL_STEP_KIND[cmd] || String(cmd || '').toLowerCase();
  return kind;
}

function createExecLog() {
  var log = document.createElement('div');
  log.className = 'ai-exec-log tool-step-log';
  var title = document.createElement('div');
  title.className = 'ai-exec-log-title tool-step-log-title';
  title.textContent = 'Tools';
  log.appendChild(title);
  return log;
}

function addExecStep(log, cmd, arg) {
  var kind = toolStepLabel(cmd);
  var step = document.createElement('div');
  step.className = 'ai-exec-step tool-step tool-step--pending pending tool-step-' + kind;
  step.dataset.toolKind = kind;
  step.dataset.toolCmd = cmd;
  step.innerHTML =
    '<div class="ai-exec-step-icon tool-step-icon"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="9"/></svg></div>' +
    '<span class="ai-exec-step-cmd tool-step-cmd">' + escapeHtml(kind) + '</span>' +
    '<span class="ai-exec-step-arg tool-step-arg">' + escapeHtml(arg) + '</span>' +
    '<span class="ai-exec-step-meta tool-step-meta">pending</span>';
  log.appendChild(step);
  return step;
}

function setExecStepState(step, state, meta) {
  var kind = step.dataset.toolKind || 'step';
  step.className = 'ai-exec-step tool-step tool-step--' + state + ' ' + state + ' tool-step-' + kind;
  var metaEl = step.querySelector('.ai-exec-step-meta, .tool-step-meta');
  var metaText = meta || (state === 'pending' ? 'pending' : state === 'running' ? '' : state === 'done' ? 'done' : state === 'error' ? 'error' : '');
  if (metaEl) metaEl.textContent = metaText;
  var iconEl = step.querySelector('.ai-exec-step-icon, .tool-step-icon');
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
    card.className = 'ai-change-card tool-change-card tool-change-card--' + (isNew ? 'create' : 'edit');
    card.setAttribute('role', 'group');
    card.setAttribute('aria-label', (isNew ? 'Создание файла' : 'Изменение файла') + ': ' + relPath);
    card.innerHTML = `
      <div class="ai-change-header tool-change-header">
        <span class="ai-change-cmd tool-change-cmd ${isNew ? 'create' : 'edit'}">${isNew ? 'Create' : 'Edit'}</span>
        <span class="ai-change-path tool-change-path" title="${escapeHtml(fullPath)}">${escapeHtml(relPath)}</span>
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
      <div class="ai-change-actions tool-change-actions">
        <button type="button" class="ai-change-reject tool-change-reject">Reject</button>
        <button type="button" class="ai-change-accept tool-change-accept">Accept</button>
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
      card.classList.add('ai-change-accepted', 'tool-change-accepted');
      setTimeout(() => card.remove(), 500);
      resolve(true);
    });
    card.querySelector('.ai-change-reject').addEventListener('click', () => {
      card.classList.add('ai-change-rejected', 'tool-change-rejected');
      setTimeout(() => card.remove(), 500);
      resolve(false);
    });
  });
}

function showAiDeleteCard(fullPath, relPath) {
  return new Promise(async (resolve) => {
    const msgArea = document.getElementById('ai-messages');
    if (!msgArea) { resolve(false); return; }

    var preview = '';
    var lineCount = 0;
    try {
      if (await window.api.exists(fullPath)) {
        const content = await window.api.readFile(fullPath);
        const lines = String(content || '').split('\n');
        lineCount = lines.length;
        preview = lines.slice(0, 10).join('\n');
      }
    } catch (_) {}

  const card = document.createElement('div');
    card.className = 'ai-change-card tool-change-card tool-change-card--delete';
    card.setAttribute('role', 'group');
    card.setAttribute('aria-label', 'Удаление файла: ' + relPath);
    var previewBlock = preview
      ? '<details class="ai-change-preview tool-change-preview"><summary>Предпросмотр</summary>'
        + '<pre class="ai-change-pre tool-change-pre"><code>' + escapeHtml(preview) + (lineCount > 10 ? '\n…' : '') + '</code></pre></details>'
      : '<p class="tool-change-note">Файл будет перемещён в .trash (восстановимый).</p>';
    card.innerHTML = ''
      + '<div class="ai-change-header tool-change-header">'
      + '<span class="ai-change-cmd tool-change-cmd delete">Delete</span>'
      + '<span class="ai-change-path tool-change-path" title="' + escapeHtml(fullPath) + '">' + escapeHtml(relPath) + '</span>'
      + '</div>'
      + '<div class="ai-change-stats tool-change-stats">'
      + (lineCount ? '<span class="ai-change-stat info">' + lineCount + ' строк</span>' : '')
      + '<span class="ai-change-stat info">→ .trash</span>'
      + '</div>'
      + previewBlock
      + '<div class="ai-change-actions tool-change-actions">'
      + '<button type="button" class="ai-change-reject tool-change-reject">Reject</button>'
      + '<button type="button" class="ai-change-accept tool-change-accept">Accept</button>'
      + '</div>';

    msgArea.appendChild(card);
    msgArea.scrollTop = msgArea.scrollHeight;

    card.querySelector('.ai-change-accept').addEventListener('click', () => {
      card.classList.add('ai-change-accepted', 'tool-change-accepted');
      setTimeout(() => card.remove(), 500);
      resolve(true);
    });
    card.querySelector('.ai-change-reject').addEventListener('click', () => {
      card.classList.add('ai-change-rejected', 'tool-change-rejected');
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

/** Strip accidental markdown fences / BOM from agent file bodies */
function unwrapAccidentalMarkdownFence(body) {
  var s = String(body || '').replace(/^\uFEFF/, '');
  var m = s.match(/^```[a-zA-Z0-9_+.-]*\r?\n([\s\S]*?)\r?\n```\s*$/);
  if (m) return m[1];
  // Leading/trailing fence only
  s = s.replace(/^```[a-zA-Z0-9_+.-]*\r?\n/, '');
  s = s.replace(/\r?\n```\s*$/, '');
  return s;
}

/**
 * Remove common LLM leftovers from file bodies before write.
 * Keeps real code; drops placeholder / "AI was here" noise.
 */
function sanitizeAgentFileBody(body, filePath) {
  var s = unwrapAccidentalMarkdownFence(body);
  var lines = s.split(/\r?\n/);
  var out = [];
  var junkLine = /^\s*(?:\/\/|#|\/\*|\*|<!--)?\s*(?:\.{3}|\u2026)\s*(?:existing code|rest of (?:the )?file|rest of code|остальн\w*|без изменений|keep (?:the )?rest|unchanged|previous code|code here|insert (?:code|here)|your code here).*$/i;
  var aiStamp = /^\s*(?:\/\/|#|\/\*|\*|<!--|;|--)\s*.*\b(?:изменен[оа]\s*AI|changed by\s*AI|AI[- ]generated|generated by\s*(?:AI|ChatGPT|Claude|Copilot|Cursor|Sirius)|TODO:\s*AI|FIXME:\s*AI|BEGIN AI|END AI)\b.*$/i;
  var loneEllipsis = /^\s*(?:\/\/|#)?\s*(?:\.{3}|\u2026)\s*(?:\/\/|#)?\s*$/;
  var cursorFence = /^\s*(?:\/\/|#)\s*(?:<<<|>>>)\s*.*$/;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (junkLine.test(line)) continue;
    if (aiStamp.test(line)) continue;
    if (loneEllipsis.test(line)) continue;
    if (cursorFence.test(line)) continue;
    out.push(line);
  }
  s = out.join('\n');
  // Collapse >2 blank lines
  s = s.replace(/\n{4,}/g, '\n\n\n');
  // Trim trailing whitespace per line lightly on trailing file junk only
  s = s.replace(/[ \t]+\n/g, '\n').replace(/\n+$/, '\n');
  if (s && !/\n$/.test(s)) s += '\n';
  return s;
}

/** Returns human-readable reasons if body still looks like a sloppy fragment */
function fileBodyQualityIssues(body, filePath, cmd) {
  var s = String(body || '');
  var issues = [];
  if (!s.trim()) {
    issues.push('пустое тело файла');
    return issues;
  }
  if (/```/.test(s)) issues.push('markdown ``` внутри файла');
  if (/\bexisting code\b|\brest of (?:the )?file\b|\bостальн\w*\s+без\s+изменений\b|\bkeep the rest\b|\bcode continues\b/i.test(s)) {
    issues.push('placeholder вместо полного файла («existing code» / «остальное…»)');
  }
  if (/(?:изменен[оа]\s*AI|changed by\s*AI|AI[- ]generated|generated by\s*(?:AI|ChatGPT|Claude|Copilot|Cursor))/i.test(s)) {
    issues.push('AI-штамп в комментариях');
  }
  // Truncation smell: file ends mid-placeholder
  if (/\.\.\.\s*$/.test(s.trim()) && s.trim().length < 80) {
    issues.push('файл обрезан (заканчивается на …)');
  }
  // EDIT of known large file shrunk to tiny stub
  if (cmd === 'EDITFILE' && filePath && openFiles[filePath] && String(openFiles[filePath].content || '').length > 800) {
    var prevLen = String(openFiles[filePath].content || '').length;
    if (s.length < Math.min(200, prevLen * 0.15) && /pass\b|\.\.\.|TODO|NotImplemented|FIXME/i.test(s)) {
      issues.push('подозрительно короткое тело вместо полного файла');
    }
  }
  return issues;
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
  // Broad intent — real gate is project grant + Accept/Reject cards.
  return /(созда|измени|исправ|обнов|добав|перепиш|сделай|напиш|реализ|улучш|граф|gui|оболоч|интерфейс|окно|заполн|отрефактор|прорефактор|построй|реструктур|перенес|перемест|оптимиз|задокумент|покрой|генер|в файле|в код|create|edit|update|fix|refactor|implement|change|write|build|generate|add|modify|move|rename|optimize|document|patch|improve|ui)/i.test(s);
}

function projectWriteGrantKey(root) {
  return 'sirius_write_grant_v1:' + String(root || '');
}

function hasProjectWriteGrant(root) {
  if (!root) return false;
  try { return localStorage.getItem(projectWriteGrantKey(root)) === '1'; } catch (_) { return false; }
}

function setProjectWriteGrant(root, on) {
  if (!root) return;
  try {
    if (on) localStorage.setItem(projectWriteGrantKey(root), '1');
    else localStorage.removeItem(projectWriteGrantKey(root));
  } catch (_) {}
}

/** Ask once per project: after grant, CREATE/EDIT apply automatically (no per-file Accept). */
async function ensureProjectWriteAccess() {
  if (!projectRoot) return false;
  if (hasProjectWriteGrant(projectRoot)) return true;
  if (typeof showConfirm !== 'function') {
    setProjectWriteGrant(projectRoot, true);
    return true;
  }
  var ok = await showConfirm(
    'Разрешить агенту автоматически создавать и изменять файлы в этом проекте?\n\n' +
    projectRoot +
    '\n\nПосле «Разрешить» агент пишет файлы сам (без карточек на каждый файл).',
    {
      title: 'Доступ агента к проекту',
      okText: 'Разрешить',
      cancelText: 'Запретить',
      danger: false,
    }
  );
  if (ok) {
    setProjectWriteGrant(projectRoot, true);
    if (typeof toast === 'function') toast('Автозапись агента включена', 'success', 2500);
  }
  return !!ok;
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

async function execTools(tools, onToolProgress, userText, sessionReads) {
  const results = [];
  const actions = [];
  const details = [];
  const readSet = sessionReads || new Set();
  const notify = (phase, t, idx, total, ok, error) => {
    if (typeof onToolProgress !== 'function') return;
    try { onToolProgress(phase, t, idx, total, ok, error); } catch (_) {}
  };
  var list = Array.isArray(tools) ? tools.slice(0, MAX_TOOL_CALLS_PER_REPLY) : [];
  var allowClear = hasClearFileIntent(userText);
  var allowDelete = hasDeleteIntent(userText);
  var projectWriteOk = null; // lazy: ask once per execTools batch
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
    var normKey = String(fullPath || '').replace(/\\/g, '/').toLowerCase();
    notify('start', t, i, list.length);
    try {
      if (t.cmd === 'CREATEFILE' || t.cmd === 'EDITFILE') {
        // Ask project grant once; then auto-write (no per-file Accept)
        if (projectWriteOk === null) {
          projectWriteOk = await ensureProjectWriteAccess();
        }
        if (!projectWriteOk) {
          var noGrant = 'Нет разрешения на запись в проект (пользователь отклонил)';
          results.push(`Ошибка ${t.cmd} ${t.arg}: ${noGrant}`);
          actions.push({ cmd: t.cmd, arg: t.arg, ok: false, error: noGrant });
          details.push({ cmd: t.cmd, arg: t.arg, ok: false, error: noGrant });
          notify('done', t, i, list.length, false, noGrant);
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
        // Clean LLM leftovers, then reject if still a fragment/slop
        var cleanBody = sanitizeAgentFileBody(t.body, fullPath);
        var qualityIssues = fileBodyQualityIssues(cleanBody, fullPath, t.cmd);
        if (qualityIssues.length) {
          var sloppy = 'Мусор/фрагмент в теле файла — запись отклонена: ' + qualityIssues.join('; ') +
            '. Пришли ПОЛНЫЙ чистый файл без «existing code», AI-комментов и ```.';
          results.push(`Ошибка ${t.cmd} ${t.arg}: ${sloppy}`);
          actions.push({ cmd: t.cmd, arg: t.arg, ok: false, error: sloppy });
          details.push({ cmd: t.cmd, arg: t.arg, ok: false, error: sloppy });
          notify('done', t, i, list.length, false, sloppy);
          continue;
        }
        t.body = cleanBody;
        // Project grant = auto-apply CREATE/EDIT (no per-file Accept/Reject)
        await window.api.writeFile(fullPath, cleanBody);
        invalidateProjectTreeCache();
        if (!openFiles[fullPath]) openFiles[fullPath] = { content: cleanBody, savedContent: cleanBody, modified: false };
        else {
          openFiles[fullPath].content = cleanBody;
          openFiles[fullPath].modified = false;
        }
        await openFile(fullPath);
        highlightAiChanges(originalContent, cleanBody);
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
        if (!allowDelete) {
          var noDel = 'Удаление заблокировано: в запросе нет явного намерения удалить файл';
          results.push(`Ошибка ${t.cmd} ${t.arg}: ${noDel}`);
          actions.push({ cmd: t.cmd, arg: t.arg, ok: false, error: noDel });
          details.push({ cmd: t.cmd, arg: t.arg, ok: false, error: noDel });
          notify('done', t, i, list.length, false, noDel);
          continue;
        }
        const deleteAccepted = await showAiDeleteCard(fullPath, t.arg);
        if (!deleteAccepted) {
          const rejected = 'Отклонено пользователем';
          results.push(`DELETEFILE ${t.arg}: ${rejected}`);
          actions.push({ cmd: t.cmd, arg: t.arg, ok: false, error: rejected });
          details.push({ cmd: t.cmd, arg: t.arg, ok: false, error: rejected });
          notify('done', t, i, list.length, false, rejected);
          continue;
        }
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
        invalidateProjectTreeCache();
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
        var dirPath = fullPath;
        try {
          if (window.api.stat) {
            var st = await window.api.stat(fullPath);
            if (st && st.isFile) {
              // Model often passes a file to READDIR — list parent instead
              dirPath = fullPath.replace(/[\\/][^\\/]+$/, '') || projectRoot;
            }
          }
        } catch (_) {}
        var dirKey = 'dir:' + String(dirPath || '').replace(/\\/g, '/').toLowerCase();
        if (readSet.has(dirKey)) {
          var skipDir = 'READDIR ' + t.arg + ': (уже читали в этой сессии — не дублируй; используй прошлый listing)';
          results.push(skipDir);
          actions.push({ cmd: t.cmd, arg: t.arg, ok: true, skipped: true });
          details.push({ cmd: t.cmd, arg: t.arg, ok: true, skipped: true, data: '' });
          notify('done', t, i, list.length, true, null);
          continue;
        }
        const entries = await window.api.readDir(dirPath);
        const listing = entries.map(function (e) { return (e.isDirectory ? 'd ' : 'f ') + e.name; }).join('\n');
        readSet.add(dirKey);
        results.push(`READDIR ${t.arg}:\n${listing}`);
        actions.push({ cmd: t.cmd, arg: t.arg, ok: true });
        details.push({ cmd: t.cmd, arg: t.arg, ok: true, data: listing });
      } else if (t.cmd === 'READFILE') {
        if (readSet.has(normKey)) {
          var skipRead = 'READFILE ' + t.arg + ': (уже в контексте сессии — не дублируй READ; используй прошлый результат)';
          results.push(skipRead);
          actions.push({ cmd: t.cmd, arg: t.arg, ok: true, skipped: true });
          details.push({ cmd: t.cmd, arg: t.arg, ok: true, skipped: true, data: '' });
          notify('done', t, i, list.length, true, null);
          continue;
        }
        var content = await window.api.readFile(fullPath);
        content = String(content || '');
        if (content.length > MAX_READFILE_CHARS) {
          content = content.slice(0, MAX_READFILE_CHARS) + '\n\n/* … truncated by IDE (' + MAX_READFILE_CHARS + ' chars) … */\n';
        }
        readSet.add(normKey);
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

// Lean context for local LLMs — tools can READFILE for more
var MAX_CONTEXT_FILE = 48000;
var MAX_TREE_DEPTH = 3;
var MAX_READFILE_CHARS = 120000;

async function buildContextBlock(opts) {
  var root = projectRoot;
  if (!root) return '';
  var name = root.split(/[\\/]/).pop();
  var skipTree = opts && opts.skipTree;
  var tree = '';
  if (!skipTree) {
    try { tree = await getCachedProjectTree(root, MAX_TREE_DEPTH); } catch (_) {}
  }
  var currentFileBlock = '';
  if (activeFile) {
    var content = editor ? editor.getValue() : (openFiles[activeFile]?.content || '');
    var relPath = root ? activeFile.replace(root.replace(/[\\/]$/, ''), '').replace(/^[\\/]/, '') : activeFile;
    var lang = langOf(activeFile);
    currentFileBlock = '\n<current_file path="' + relPath.replace(/"/g, '&quot;') + '" language="' + lang + '">\n' + content.slice(0, MAX_CONTEXT_FILE) + '\n</current_file>';
  }
  return '<environment>\n<project_root>' + root + '</project_root>\n<project_name>' + (name || '') + '</project_name>\n<trash_info>DELETEFILE → .trash/ после подтверждения.</trash_info>\n<project_tree>\n' + (tree || '(empty)') + '</project_tree>' + currentFileBlock + '\n</environment>';
}

/** One compact system block — no duplicated Accept/Reject myths */
var SIRIUS_SYSTEM_INSTRUCTION = `
Ты — Sirius Agent (локальный LLM в IDE). Senior-разработчик. Язык ответа = язык пользователя.
Пиши production-код без мусора и без AI-штампов.

ИНСТРУМЕНТЫ (пути только относительные от project_root, без ../):
[READDIR:path]  [READFILE:path]  [CREATEFILE:path]+тело  [EDITFILE:path]+ПОЛНОЕ тело  [DELETEFILE:path]

ЦИКЛ: Observe → Act → Verify
• Сначала читай: READDIR структуры, затем READFILE всех связанных файлов (импорты, соседи, конфиги). Не угадывай.
• Не повторяй READFILE того же пути — содержимое уже в tool_results.
• ACTION: после достаточного чтения сразу EDITFILE/CREATEFILE полным файлом. Код только в инструмент, не «вот код» в чат.
• DELETEFILE — только если пользователь явно просил удалить; IDE спросит подтверждение → .trash/
• CREATE/EDIT после разрешения на проект пишутся сразу (без per-file Accept). Тела полные, без «… existing code …» и без \`\`\`.
• Долгие задачи: GOAL_DONE: итог когда готово.

СТИЛЬ: сохраняй отступы/кавычки файла; не дублируй функции; не оставляй debug-логи без просьбы.
`;

function buildAgentSystemPrompt(opts) {
  opts = opts || {};
  var parts = [];
  var userSys = (typeof getSystemPrompt === 'function' ? getSystemPrompt() : '') || '';
  if (userSys.trim()) parts.push(userSys.trim());
  parts.push(SIRIUS_SYSTEM_INSTRUCTION.trim());
  if (opts.wantsAction) {
    parts.push('[ACTION] Нужны правки файлов. Сначала дочитай связанные файлы (READ*), затем EDITFILE/CREATEFILE полным телом. Не останавливайся на одних READ.');
  } else if (opts.mode === 'agent') {
    parts.push('[AGENT] Можно читать файлы. Пиши в проект только если задача этого требует. Формат: [CMD:path] или JSON tool_calls.');
  } else {
    parts.push('[CHAT] Краткий ответ. Без файловых команд CREATEFILE/EDITFILE/DELETEFILE.');
  }
  if (opts.sessionXml) {
    parts.push(opts.sessionXml);
    parts.push('Долгая сессия: продолжай по цели, прогресс в файлах, финал GOAL_DONE.');
  }
  if (opts.readHint) parts.push(opts.readHint);
  return parts.join('\n\n');
}

/* Long-horizon agent: many tool rounds + auto-continues (~hours of work) */
var MAX_TOOL_ROUNDS = 32;
var MAX_AGENT_CONTINUES = 48; // outer loops after a "done" reply if goal still open
var AGENT_KEEP_RECENT_MSGS = 12;
var AGENT_SUMMARIZE_AFTER_MSGS = 16;
/* Soft JSON hint — strict schema truncates long EDITFILE bodies on local models */
var AGENT_JSON_RESPONSE_FORMAT = { type: 'json_object' };

var ACT_NOW_NUDGE =
  '<agent_directive id="act">Контекст собран. Сейчас EDITFILE/CREATEFILE с ПОЛНЫМ чистым телом. Без «existing code» и без ```. Не повторяй READ того же пути.</agent_directive>';

var OBSERVE_MORE_NUDGE =
  '<agent_directive id="observe">Мало контекста. Сначала READDIR нужных папок и READFILE связанных файлов (импорты, соседи, конфиги). Не дублируй уже прочитанные пути. Потом правь.</agent_directive>';

var CLEAN_CODE_NUDGE =
  '<agent_directive id="clean">Запись отклонена (мусор/фрагмент). Пришли ПОЛНЫЙ чистый файл через EDITFILE/CREATEFILE.</agent_directive>';

var CONTINUE_GOAL_NUDGE =
  '<agent_directive id="continue">Цель не закрыта. Следующий шаг инструментами. Готово → GOAL_DONE: итог. Не переспрашивай.</agent_directive>';

function ensureAgentState(chat) {
  if (!chat) return null;
  if (!chat.agent || typeof chat.agent !== 'object') {
    chat.agent = {
      goal: '',
      summary: '',
      status: 'idle',
      startedAt: null,
      updatedAt: null,
      steps: [],
      continues: 0,
    };
  }
  if (!Array.isArray(chat.agent.steps)) chat.agent.steps = [];
  return chat.agent;
}

function renderAgentSessionBar() {
  var bar = $('ai-session-bar');
  var goalEl = $('ai-session-goal');
  var metaEl = $('ai-session-meta');
  var clearBtn = $('btn-clear-agent-goal');
  if (!bar || !goalEl || !metaEl) return;
  var chat = currentChat();
  var ag = chat && chat.agent;
  if (!ag || !ag.goal) {
    bar.hidden = true;
    if (clearBtn) clearBtn.hidden = true;
    return;
  }
  bar.hidden = false;
  if (clearBtn) clearBtn.hidden = false;
  goalEl.textContent = 'Цель: ' + ag.goal;
  var parts = [];
  if (ag.status) parts.push(ag.status);
  if (ag.steps && ag.steps.length) parts.push('шагов: ' + ag.steps.length);
  if (ag.continues) parts.push('продолжений: ' + ag.continues);
  if (ag.summary) parts.push('есть саммари');
  metaEl.textContent = parts.join(' · ');
}

function clearAgentGoal() {
  var chat = currentChat();
  if (!chat) return;
  chat.agent = null;
  saveChats();
  persistAgentSessionToProject(chat).catch(function () {});
  renderAgentSessionBar();
  if (typeof toast === 'function') toast('Цель агента сброшена', 'info', 1800);
}

function activateAgentGoal(chat, userText, mode) {
  var ag = ensureAgentState(chat);
  if (mode !== 'agent') return ag;
  var text = String(userText || '').trim();
  if (!text) return ag;
  var isContinue = /продолж|дальше|continue|keep going|ещё|еще|go on/i.test(text);
  if (!ag.goal || (!isContinue && hasActionIntent(text))) {
    ag.goal = text.length > 280 ? text.slice(0, 277) + '…' : text;
    ag.startedAt = ag.startedAt || new Date().toISOString();
    ag.status = 'running';
    ag.continues = 0;
  } else if (isContinue && ag.goal) {
    ag.status = 'running';
  } else if (!ag.goal) {
    ag.goal = text.length > 280 ? text.slice(0, 277) + '…' : text;
    ag.startedAt = new Date().toISOString();
    ag.status = 'running';
  }
  ag.updatedAt = new Date().toISOString();
  return ag;
}

function appendAgentStep(chat, step) {
  var ag = ensureAgentState(chat);
  ag.steps.push(Object.assign({ ts: new Date().toISOString() }, step || {}));
  if (ag.steps.length > 200) ag.steps = ag.steps.slice(-200);
  ag.updatedAt = new Date().toISOString();
}

function buildLocalAgentSummary(chat, actions) {
  var ag = ensureAgentState(chat);
  var lines = [];
  if (ag.goal) lines.push('Goal: ' + ag.goal);
  var recent = (ag.steps || []).slice(-12);
  if (recent.length) {
    lines.push('Recent steps:');
    recent.forEach(function (s) {
      lines.push('- ' + (s.ok ? 'ok' : 'fail') + ' ' + (s.cmd || '') + ' ' + (s.arg || '') + (s.note ? ' (' + s.note + ')' : ''));
    });
  }
  if (actions && actions.length) {
    var writes = actions.filter(function (a) { return a && a.ok && /CREATEFILE|EDITFILE/.test(a.cmd); });
    if (writes.length) {
      lines.push('Files touched:');
      writes.slice(-8).forEach(function (a) { lines.push('- ' + a.cmd + ' ' + a.arg); });
    }
  }
  var msgs = (chat.messages || []).slice(-6);
  if (msgs.length) {
    lines.push('Recent chat:');
    msgs.forEach(function (m) {
      var snip = String(m.content || '').replace(/\s+/g, ' ').slice(0, 160);
      lines.push('- ' + m.role + ': ' + snip);
    });
  }
  ag.summary = lines.join('\n').slice(0, 6000);
  ag.updatedAt = new Date().toISOString();
  return ag.summary;
}

function buildAgentSessionXml(chat) {
  var ag = ensureAgentState(chat);
  if (!ag.goal) return '';
  return '<agent_session>\n' +
    '<goal>' + String(ag.goal).replace(/</g, '') + '</goal>\n' +
    '<status>' + (ag.status || 'running') + '</status>\n' +
    '<summary>\n' + (ag.summary || '(empty)') + '\n</summary>\n' +
    '<rules>Работай долго и последовательно. Сохраняй прогресс через файлы. Не сбрасывай цель. Когда всё готово — GOAL_DONE.</rules>\n' +
    '</agent_session>';
}

function compressMessagesForApi(chatMessages, agentSummary) {
  var msgs = Array.isArray(chatMessages) ? chatMessages.slice() : [];
  if (msgs.length <= AGENT_KEEP_RECENT_MSGS) return msgs;
  var older = msgs.slice(0, -AGENT_KEEP_RECENT_MSGS);
  var recent = msgs.slice(-AGENT_KEEP_RECENT_MSGS);
  var digest = agentSummary || older.map(function (m) {
    return (m.role || '?') + ': ' + String(m.content || '').replace(/\s+/g, ' ').slice(0, 120);
  }).slice(-20).join('\n');
  return [{
    role: 'user',
    content: '<conversation_digest>\nСжатый контекст длинного чата (старые сообщения свёрнуты):\n' + digest + '\n</conversation_digest>',
  }].concat(recent);
}

function replyMarksGoalDone(text) {
  return /GOAL_DONE\s*:/i.test(String(text || ''));
}

function goalLooksLongHorizon(goal) {
  var g = String(goal || '');
  if (g.length > 140) return true;
  return /затем|потом|также|все\s+файл|весь\s+проект|рефактор|мигрир|implement|refactor|migrate|hours|часа|долго|пошагов|и\s+ещё|and\s+then|all\s+files/i.test(g);
}

function replySuggestsMoreWork(text) {
  return /далее|следующ|сейчас\s+сделаю|осталось|продолж|TODO|ещё\s+нуж|next\s+i|then\s+i('|’)ll|remaining|will\s+continue/i.test(String(text || ''));
}

async function persistAgentSessionToProject(chat) {
  if (!projectRoot || !chat || !window.api || !window.api.writeFile) return;
  try {
    var sep = projectRoot.indexOf('/') !== -1 ? '/' : '\\';
    var dir = projectRoot.replace(/[\\/]$/, '') + sep + '.sirius';
    if (!(await window.api.exists(dir))) await window.api.mkdir(dir);
    var payload = {
      chatId: chat.id,
      chatName: chat.name,
      savedAt: new Date().toISOString(),
      projectRoot: projectRoot,
      agent: chat.agent || null,
      messageCount: (chat.messages || []).length,
      lastMessages: (chat.messages || []).slice(-8).map(function (m) {
        return { role: m.role, content: String(m.content || '').slice(0, 2000) };
      }),
    };
    await window.api.writeFile(dir + sep + 'agent-session.json', JSON.stringify(payload, null, 2));
  } catch (_) {}
}

async function tryRestoreAgentSessionFromProject() {
  if (!projectRoot || !window.api || !window.api.readFile) return;
  try {
    var sep = projectRoot.indexOf('/') !== -1 ? '/' : '\\';
    var p = projectRoot.replace(/[\\/]$/, '') + sep + '.sirius' + sep + 'agent-session.json';
    if (!(await window.api.exists(p))) return;
    var raw = await window.api.readFile(p);
    var data = JSON.parse(raw);
    if (!data || !data.agent || !data.agent.goal) return;
    var chat = currentChat();
    if (!chat) return;
    if (chat.agent && chat.agent.goal) {
      renderAgentSessionBar();
      return;
    }
    chat.agent = data.agent;
    if (chat.agent.status === 'running') chat.agent.status = 'paused';
    saveChats();
    renderAgentSessionBar();
    if (typeof toast === 'function') {
      toast('Восстановлена цель агента: ' + String(chat.agent.goal).slice(0, 80), 'info', 3200);
    }
  } catch (_) {}
}

async function sendMessage() {
  if (_aiRequestInFlight) {
    if (_currentStreamAbort) _currentStreamAbort.abort();
    if (window.api && window.api.abortLLMStream) window.api.abortLLMStream();
    else if (window.api && window.api.abortLMStudioStream) window.api.abortLMStudioStream();
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
  sendBtn.classList.add('is-stopping', 'ai-composer-stop');
  sendBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg><span class="ai-send-stop-label">Стоп</span>';
  sendBtn.title = 'Остановить запрос';
  sendBtn.onclick = function () {
    if (_currentStreamAbort) _currentStreamAbort.abort();
    if (window.api && window.api.abortLLMStream) window.api.abortLLMStream();
    else if (window.api && window.api.abortLMStudioStream) window.api.abortLMStudioStream();
  };
  inp.disabled = true;
  _aiRequestInFlight = true;

  const chat = currentChat();
  if (!chat) {
    _aiRequestInFlight = false;
    inp.disabled = false;
    sendBtn.classList.remove('is-stopping', 'ai-composer-stop');
    return;
  }

  chat.messages.push({ role: 'user', content: text });
  renderMessages(true);

  var mode = getAIMode();
  var apiOptions = getLMOptions(mode);
  var ag = null;
  if (mode === 'agent') {
    ag = activateAgentGoal(chat, text, mode);
    saveChats();
    renderAgentSessionBar();
    persistAgentSessionToProject(chat).catch(function () {});
  }
  var wantsAction = mode === 'agent' && (hasActionIntent(text) || !!(ag && ag.goal && ag.status === 'running'));
  // Prefer bracket tools for ACTION (long file bodies). Soft JSON only for light agent turns.
  if (mode === 'agent' && !wantsAction) {
    apiOptions.response_format = AGENT_JSON_RESPONSE_FORMAT;
  }
  var sessionXml = mode === 'agent' ? buildAgentSessionXml(chat) : '';
  var sysContent = buildAgentSystemPrompt({
    mode: mode,
    wantsAction: wantsAction,
    sessionXml: sessionXml || '',
  });
  var sysMsg = { role: 'system', content: sysContent };
  var sessionReads = new Set();
  var uniqueReads = 0;
  var observeNudged = false;

  var contextBlock = await buildContextBlock();
  var lastUserContent = chat.messages[chat.messages.length - 1].content;
  var prior = chat.messages.slice(0, -1).map(function (m) { return { role: m.role, content: m.content }; });
  var messagesForApi = compressMessagesForApi(prior, ag && ag.summary);
  messagesForApi.push({
    role: 'user',
    content: contextBlock ? contextBlock + '\n\n---\n\n' + lastUserContent : lastUserContent,
  });

  var apiMessages = [sysMsg].concat(messagesForApi);
  var msgsEl = $('ai-messages');
  var typingEl = null;
  var streamBodyEl = null;
  var streamRenderTimer = null;
  var streamPendingHtml = '';
  var committedParts = []; // frozen assistant snippets across tool rounds

  function ensureTypingBubble(phaseHint) {
    if (typingEl && typingEl.parentNode) return typingEl;
    typingEl = document.createElement('div');
    typingEl.className = 'msg msg-assistant msg-streaming';
    typingEl.innerHTML = ''
      + '<div class="msg-header msg-header-streaming"><span class="msg-role">Агент</span></div>'
      + '<div class="ai-stream-wrap">'
      + '<div class="ai-phase-label phase-thinking">Analyzing</div>'
      + '<div class="typing-indicator ai-stream-pending">'
      + '<span class="ai-stream-pulse" aria-hidden="true"></span>'
      + '<span class="ai-stream-pending-text">Думаю…</span>'
      + '</div></div>';
    msgsEl.append(typingEl);
    streamBodyEl = null;
    msgsEl.scrollTop = msgsEl.scrollHeight;
    if (phaseHint) setStreamPhase(phaseHint);
    return typingEl;
  }

  function flushStreamRender() {
    streamRenderTimer = null;
    if (!typingEl) return;
    var wrap = typingEl.querySelector('.ai-stream-wrap');
    if (!wrap) return;
    var body = wrap.querySelector('.msg-body-streaming');
    if (!body) {
      var pending = wrap.querySelector('.ai-stream-pending');
      if (pending) pending.remove();
      body = document.createElement('div');
      body.className = 'msg-body msg-body-streaming';
      wrap.appendChild(body);
      var caret = document.createElement('span');
      caret.className = 'ai-stream-caret';
      caret.setAttribute('aria-hidden', 'true');
      wrap.appendChild(caret);
      streamBodyEl = body;
    }
    if (body.innerHTML !== streamPendingHtml) {
      body.innerHTML = streamPendingHtml;
    }
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function renderStreamChunk(cleanedSoFar) {
    streamPendingHtml = renderMarkdownSafe(cleanedSoFar || '');
    if (streamRenderTimer) return;
    // ~30fps — smoother than rewriting every token
    streamRenderTimer = setTimeout(flushStreamRender, 32);
  }

  /** Freeze current stream text as a permanent bubble; next round gets a fresh one */
  function commitStreamingTurn(rawReply, opts) {
    opts = opts || {};
    if (streamRenderTimer) {
      clearTimeout(streamRenderTimer);
      streamRenderTimer = null;
      flushStreamRender();
    }
    var text = cleanReply(rawReply || '');
    if (mode === 'agent' && (looksLikeAgentJson(rawReply) || looksLikeAgentJson(text))) {
      var st = parseStructuredToolCalls(rawReply);
      text = st ? st.reply : text;
    }
    if (mode === 'agent' && /"assistant_reply"|"tool_calls"/.test(text)) text = '';
    text = stripLeakedToolText(text);
    if (typingEl && typingEl.parentNode) {
      if (text && text.trim()) {
        typingEl.classList.remove('msg-streaming');
        typingEl.classList.add('msg-enter', 'msg-committed');
        var wrap = typingEl.querySelector('.ai-stream-wrap');
        if (wrap) {
          var phase = wrap.querySelector('.ai-phase-label');
          if (phase) phase.remove();
          var caret = wrap.querySelector('.ai-stream-caret');
          if (caret) caret.remove();
          var pending = wrap.querySelector('.ai-stream-pending');
          if (pending) pending.remove();
          var body = wrap.querySelector('.msg-body-streaming') || wrap.querySelector('.msg-body');
          if (!body) {
            body = document.createElement('div');
            body.className = 'msg-body';
            wrap.appendChild(body);
          }
          body.className = 'msg-body';
          body.innerHTML = renderMarkdownSafe(text);
        }
        committedParts.push(text);
      } else {
        // No visible prose — drop empty stream shell (tools speak via exec log)
        typingEl.remove();
      }
    }
    typingEl = null;
    streamBodyEl = null;
    streamPendingHtml = '';
    if (opts.startNext !== false) {
      ensureTypingBubble(opts.nextPhase || 'thinking');
    }
  }

  ensureTypingBubble('thinking');

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
  var continueCount = 0;
  var userStopped = false;
  var goalCompleted = false;

  function setStreamPhase(phase) {
    ensureTypingBubble();
    var wrap = typingEl.querySelector('.ai-stream-wrap');
    if (!wrap) return;
    var label = wrap.querySelector('.ai-phase-label');
    if (!label) {
      label = document.createElement('div');
      label.className = 'ai-phase-label';
      wrap.insertBefore(label, wrap.firstChild);
    }
    var pendingText = wrap.querySelector('.ai-stream-pending-text');
    if (phase === 'thinking') {
      label.className = 'ai-phase-label phase-thinking';
      label.textContent = continueCount ? ('Шаг ' + (continueCount + 1)) : 'Analyzing';
      if (pendingText) pendingText.textContent = 'Думаю…';
    } else if (phase === 'writing') {
      label.className = 'ai-phase-label phase-writing';
      label.textContent = 'Пишет';
      if (pendingText) pendingText.textContent = '';
    } else if (phase === 'executing') {
      label.className = 'ai-phase-label phase-executing';
      label.textContent = 'Инструменты';
      if (pendingText) pendingText.textContent = 'Выполняю…';
    } else {
      label.remove();
    }
  }

  function notifyTool(phase, t, idx, total, ok, error) {
    var dot = $('ai-dot');
    if (dot && phase === 'start') dot.className = 'ai-dot loading';

    // Create exec log on first tool — place before the *next* stream bubble
    if (!execLogEl) {
      execLogEl = createExecLog();
      ensureTypingBubble('executing');
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

  function shrinkApiContext() {
    if (!ag) return;
    if (apiMessages.length <= AGENT_SUMMARIZE_AFTER_MSGS + 2) return;
    var sys = apiMessages[0];
    var rest = apiMessages.slice(1);
    apiMessages = [sys].concat(compressMessagesForApi(rest, ag.summary));
  }

  try {
    var forcedActNudge = false;
    while (!userStopped) {
      round = 0;
      forcedActNudge = false;
      var brokeWithoutTools = false;
      var toolsThisContinue = 0;

      while (round < MAX_TOOL_ROUNDS) {
        fullReply = '';
        _currentStreamAbort = new AbortController();
        ensureTypingBubble(round || continueCount ? 'thinking' : 'thinking');

        var firstChunk = true;
        await streamToLLM(apiMessages, function (chunk) {
          fullReply += chunk;
          if (firstChunk) {
            firstChunk = false;
            ensureTypingBubble();
            var pending = typingEl.querySelector('.ai-stream-pending');
            if (pending) pending.classList.add('is-hidden');
            setStreamPhase('writing');
          }
          var cleanedSoFar = cleanReply(fullReply);
          if (mode === 'agent' && !cleanedSoFar && looksLikeAgentJson(fullReply)) {
            cleanedSoFar = wantsAction ? 'Пишу изменения в файлы…' : 'Готовлю ответ…';
          }
          renderStreamChunk(cleanedSoFar);
        }, _currentStreamAbort ? _currentStreamAbort.signal : undefined, apiOptions);

        if (streamRenderTimer) {
          clearTimeout(streamRenderTimer);
          streamRenderTimer = null;
          flushStreamRender();
        }

        updateTokenIndicator(apiMessages.concat([{ role: 'assistant', content: fullReply }]));

        if (replyMarksGoalDone(fullReply)) {
          goalCompleted = true;
          brokeWithoutTools = true;
          break;
        }

        var structured = parseStructuredToolCalls(fullReply);
        var tools = structured ? structured.tools : parseToolCalls(fullReply);

        // ACTION task ended with prose / no tools → force one more round to EDIT
        if (!tools.length) {
          if (wantsAction && !actionsHaveWrites(allToolActions) && !forcedActNudge && round < MAX_TOOL_ROUNDS - 1) {
            forcedActNudge = true;
            apiMessages.push({ role: 'assistant', content: fullReply || '(пусто)' });
            apiMessages.push({ role: 'user', content: ACT_NOW_NUDGE });
            // Keep progress visible: commit this turn, then continue
            commitStreamingTurn(fullReply, { nextPhase: 'thinking' });
            round++;
            continue;
          }
          brokeWithoutTools = true;
          break;
        }

        // Commit prose before tools so the next model turn doesn't wipe the chat
        commitStreamingTurn(fullReply, { nextPhase: 'executing' });
        execLogEl = null; // new log block under the committed turn
        stepMap = {};
        setStreamPhase('executing');
        var out = await execTools(tools, notifyTool, lastUserContent, sessionReads);
        allToolActions = allToolActions.concat(out.actions || []);
        toolsThisContinue += (out.actions || []).length;
        (out.actions || []).forEach(function (a) {
          appendAgentStep(chat, { cmd: a.cmd, arg: a.arg, ok: !!a.ok, note: a.error || (a.skipped ? 'skip-dup' : '') });
        });
        uniqueReads = sessionReads.size;
        var toolResultContent = formatToolResultsForModel(out.details || []);

        apiMessages.push({ role: 'assistant', content: fullReply });
        apiMessages.push({ role: 'user', content: toolResultContent });
        round++;

        var hadSloppyWrite = (out.actions || []).some(function (a) {
          return a && !a.ok && /Мусор\/фрагмент|placeholder|existing code|AI-штамп/i.test(String(a.error || ''));
        });
        if (hadSloppyWrite && round < MAX_TOOL_ROUNDS) {
          apiMessages.push({ role: 'user', content: CLEAN_CODE_NUDGE });
        }

        // READ-only on ACTION: if still thin context → read more; else act
        if (
          wantsAction &&
          toolsAreReadOnly(tools) &&
          !actionsHaveWrites(allToolActions) &&
          round < MAX_TOOL_ROUNDS
        ) {
          if (uniqueReads < 2 && !observeNudged) {
            observeNudged = true;
            apiMessages.push({ role: 'user', content: OBSERVE_MORE_NUDGE });
          } else {
            apiMessages.push({ role: 'user', content: ACT_NOW_NUDGE });
            forcedActNudge = true;
          }
        }

        if (round < MAX_TOOL_ROUNDS && activeFile && toolsHaveWrites(tools)) {
          var freshCtx = await buildContextBlock({ skipTree: true }).catch(function () { return ''; });
          if (freshCtx) apiMessages.push({ role: 'user', content: '[CONTEXT_REFRESH]\n' + freshCtx });
        }

        if (ag && round % 4 === 0) {
          buildLocalAgentSummary(chat, allToolActions);
          persistAgentSessionToProject(chat).catch(function () {});
          renderAgentSessionBar();
          shrinkApiContext();
        }
      }

      if (goalCompleted || userStopped) break;
      if (mode !== 'agent' || !ag || !ag.goal) break;
      if (replyMarksGoalDone(fullReply)) {
        goalCompleted = true;
        break;
      }
      // First turn without tools and without action intent → normal answer, stop
      if (continueCount === 0 && brokeWithoutTools && !wantsAction && !allToolActions.length) break;
      // Short task: wrote files and finished with prose on first pass
      if (
        continueCount === 0 &&
        brokeWithoutTools &&
        actionsHaveWrites(allToolActions) &&
        !goalLooksLongHorizon(ag.goal) &&
        !replySuggestsMoreWork(fullReply)
      ) {
        goalCompleted = true;
        ag.status = 'done';
        break;
      }
      // Continue that produced no tools → model has nothing left to do
      if (continueCount > 0 && toolsThisContinue === 0 && brokeWithoutTools) {
        ag.status = actionsHaveWrites(allToolActions) ? 'done' : 'paused';
        if (ag.status === 'done') goalCompleted = true;
        break;
      }
      // Still only READs after a full inner loop — keep going unless capped
      if (continueCount >= MAX_AGENT_CONTINUES) {
        ag.status = 'paused';
        break;
      }

      // Commit last visible turn before auto-continue (don't erase progress)
      commitStreamingTurn(fullReply, { nextPhase: 'thinking' });
      execLogEl = null;
      stepMap = {};

      continueCount++;
      ag.continues = (ag.continues || 0) + 1;
      ag.status = 'running';
      buildLocalAgentSummary(chat, allToolActions);
      await persistAgentSessionToProject(chat);
      renderAgentSessionBar();
      shrinkApiContext();
      wantsAction = true;
      if (apiOptions.response_format) delete apiOptions.response_format;

      apiMessages.push({ role: 'assistant', content: fullReply || '(пусто)' });
      apiMessages.push({
        role: 'user',
        content: CONTINUE_GOAL_NUDGE + '\n\n' + buildAgentSessionXml(chat),
      });
      setStreamPhase('thinking');
    }
  } catch (e) {
    var errMsg = (e && e.message) ? String(e.message) : String(e);
    userStopped = errMsg.indexOf('остановлен') !== -1;
    if (fullReply === '' && !userStopped) {
      var prov = providerDisplayName(getActiveLLMConfig().providerId);
      fullReply = 'Ошибка подключения к ' + prov + ': ' + errMsg;
    }
  } finally {
    if (streamRenderTimer) {
      clearTimeout(streamRenderTimer);
      streamRenderTimer = null;
    }
    _currentStreamAbort = null;
    _aiRequestInFlight = false;
    inp.disabled = false;
    sendBtn.disabled = false;
    sendBtn.classList.remove('is-stopping', 'ai-composer-stop');
    sendBtn.innerHTML = sendBtnOriginalHtml;
    sendBtn.title = 'Отправить (Enter)';
    sendBtn.onclick = sendMessage;
    if (qaEl) qaEl.style.display = '';
  }

  // Finalize last bubble (keep committed history on screen)
  var finalText = cleanReply(fullReply);
  if (mode === 'agent' && (looksLikeAgentJson(fullReply) || looksLikeAgentJson(finalText))) {
    var finalStructured = parseStructuredToolCalls(fullReply);
    finalText = finalStructured ? finalStructured.reply : finalText;
  }
  if (mode === 'agent' && /"assistant_reply"|"tool_calls"/.test(finalText)) finalText = '';
  finalText = stripLeakedToolText(finalText);

  if (typingEl && typingEl.parentNode) {
    if (finalText && finalText.trim()) {
      commitStreamingTurn(fullReply, { startNext: false });
    } else {
      typingEl.remove();
      typingEl = null;
    }
  }

  // Remove ephemeral streaming shell only; keep committed msgs + exec logs
  document.querySelectorAll('#ai-messages .msg-streaming').forEach(function (el) {
    el.remove();
  });

  var displayReply = '';
  if (committedParts.length) {
    // Dedupe if last commit equals finalText
    var parts = committedParts.slice();
    if (finalText && finalText.trim() && parts[parts.length - 1] !== finalText) {
      // final already committed above via commitStreamingTurn — avoid double in history
    }
    displayReply = parts.filter(Boolean).join('\n\n');
  } else {
    displayReply = finalText || '';
  }
  if (userStopped && displayReply.indexOf('остановлен') === -1) displayReply += '\n\n*Запрос остановлен пользователем.*';

  if (ag) {
    buildLocalAgentSummary(chat, allToolActions);
    if (goalCompleted || replyMarksGoalDone(fullReply) || replyMarksGoalDone(displayReply)) {
      ag.status = 'done';
      goalCompleted = true;
      displayReply = String(displayReply || '').replace(/GOAL_DONE\s*:/i, '**Цель достигнута:**');
    } else if (userStopped) {
      ag.status = 'paused';
    } else if (ag.status !== 'paused') {
      ag.status = wantsAction && !actionsHaveWrites(allToolActions) ? 'running' : (ag.goal ? 'running' : 'idle');
    }
    ag.updatedAt = new Date().toISOString();
    persistAgentSessionToProject(chat).catch(function () {});
    renderAgentSessionBar();
  }

  // Append structured tool action summary
  if (allToolActions.length) {
    var doneList = allToolActions.filter(function (a) { return a.ok; });
    var errList  = allToolActions.filter(function (a) { return !a.ok; });
    var writeOk = actionsHaveWrites(allToolActions);
    var lines = [];
    doneList.forEach(function (a) {
      lines.push('✓ ' + (CMD_LABELS[a.cmd] || a.cmd) + ': **' + a.arg + '**');
    });
    errList.forEach(function (a) {
      lines.push('✗ ' + (CMD_LABELS[a.cmd] || a.cmd) + ' ' + a.arg + ': ' + (a.error || 'ошибка'));
    });
    var summaryTitle = writeOk
      ? '**Выполнено:** ' + doneList.length + '/' + allToolActions.length
      : (wantsAction && !goalCompleted
        ? '**Только чтение** — изменений в файлах нет. Напиши ещё раз или уточни файл.'
        : '**Выполнено:** ' + doneList.length + '/' + allToolActions.length);
    if (continueCount) summaryTitle += ' · авто-продолжений: ' + continueCount;
    displayReply += '\n\n---\n' + summaryTitle + '\n' + lines.join('\n');
  } else if (wantsAction && !userStopped && !goalCompleted) {
    displayReply += '\n\n---\n*Агент не записал файлы. Повтори запрос — нужен EDITFILE/CREATEFILE.*';
  }
  if (ag && ag.goal && ag.status === 'paused' && !userStopped) {
    displayReply += '\n\n---\n*Сессия на паузе (лимит продолжений). Напиши «продолжай» — агент подхватит цель из саммари.*';
  }
  chat.messages.push({ role: 'assistant', content: displayReply });
  renderMessages(true);
  saveChats();
  updateTokenIndicator(apiMessages);

  const dotEl = $('ai-dot');
  if (dotEl) dotEl.className = 'ai-dot online';
}

var _modelsPollBusy = false;
async function fetchModelsSafe() {
  if (_modelsPollBusy || _aiRequestInFlight) return;
  _modelsPollBusy = true;
  try { await fetchModels(); } finally { _modelsPollBusy = false; }
}

function startLmPoll() {
  initLLMProviderPanel();
  fetchModelsSafe();
  setInterval(fetchModelsSafe, 60000);
  setTimeout(function () {
    updateGitStatus();
    setInterval(updateGitStatus, 45000);
  }, 2500);
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
