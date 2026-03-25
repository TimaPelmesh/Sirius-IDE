/* Sirius IDE — editor.js */
'use strict';

var EDITOR_THEMES = [
  { id: 'classic', name: 'Classic' },
  { id: 'one-dark', name: 'One Dark' },
  { id: 'dracula', name: 'Dracula' },
  { id: 'nord', name: 'Nord' },
];

function getEditorThemeId() {
  return localStorage.getItem('nb_editor_theme') || 'classic';
}

function applyEditorTheme(themeId) {
  if (!themeId) return;
  localStorage.setItem('nb_editor_theme', themeId);
  updateMonacoTheme();
}

var SELECTION_BG = 'rgba(79,70,229,.2)';
var _csvLanguageRegistered = false;
var editorSecondary = null;
var _editorSplitEnabled = false;
var _secondaryFilePath = null;

function getThemeTokenRules(presetId) {
  if (presetId === 'one-dark') {
    return [
      { token: 'keyword', foreground: 'c678dd', fontStyle: 'bold' },
      { token: 'string', foreground: '98c379' },
      { token: 'number', foreground: 'd19a66' },
      { token: 'comment', foreground: '5c6370', fontStyle: 'italic' },
      { token: 'type', foreground: 'e5c07b' },
      { token: 'function', foreground: '61afef' },
      { token: 'variable', foreground: 'e06c75' },
      { token: 'delimiter.csv', foreground: '56b6c2' },
      { token: 'header.csv', foreground: 'e5c07b', fontStyle: 'bold' },
    ];
  }
  if (presetId === 'dracula') {
    return [
      { token: 'keyword', foreground: 'ff79c6', fontStyle: 'bold' },
      { token: 'string', foreground: 'f1fa8c' },
      { token: 'number', foreground: 'bd93f9' },
      { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
      { token: 'type', foreground: '8be9fd' },
      { token: 'function', foreground: '50fa7b' },
      { token: 'variable', foreground: 'f8f8f2' },
      { token: 'delimiter.csv', foreground: 'ff79c6' },
      { token: 'header.csv', foreground: '8be9fd', fontStyle: 'bold' },
    ];
  }
  if (presetId === 'nord') {
    return [
      { token: 'keyword', foreground: '81a1c1', fontStyle: 'bold' },
      { token: 'string', foreground: 'a3be8c' },
      { token: 'number', foreground: 'b48ead' },
      { token: 'comment', foreground: '616e88', fontStyle: 'italic' },
      { token: 'type', foreground: '8fbcbb' },
      { token: 'function', foreground: '88c0d0' },
      { token: 'variable', foreground: 'd8dee9' },
      { token: 'delimiter.csv', foreground: '88c0d0' },
      { token: 'header.csv', foreground: '8fbcbb', fontStyle: 'bold' },
    ];
  }
  return [
    { token: 'keyword', foreground: 'c586c0' },
    { token: 'string', foreground: 'ce9178' },
    { token: 'number', foreground: 'b5cea8' },
    { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
    { token: 'type', foreground: '4ec9b0' },
    { token: 'function', foreground: 'dcdcaa' },
    { token: 'variable', foreground: '9cdcfe' },
    { token: 'delimiter.csv', foreground: '4ec9b0' },
    { token: 'header.csv', foreground: 'dcdcaa', fontStyle: 'bold' },
  ];
}

function getLightCsvAccentRules(presetId) {
  if (presetId === 'dracula') {
    return [
      { token: 'delimiter.csv', foreground: '9f1d5c', fontStyle: 'bold' },
      { token: 'header.csv', foreground: '0f4c81', fontStyle: 'bold' },
      { token: 'number', foreground: '5b3cc4' },
    ];
  }
  if (presetId === 'nord') {
    return [
      { token: 'delimiter.csv', foreground: '0f5f8f', fontStyle: 'bold' },
      { token: 'header.csv', foreground: '1f4f35', fontStyle: 'bold' },
      { token: 'number', foreground: '5f2ea8' },
    ];
  }
  if (presetId === 'one-dark') {
    return [
      { token: 'delimiter.csv', foreground: '0b5f8a', fontStyle: 'bold' },
      { token: 'header.csv', foreground: '7a4f00', fontStyle: 'bold' },
      { token: 'number', foreground: '7a3f00' },
    ];
  }
  return [
    { token: 'delimiter.csv', foreground: '005a9e', fontStyle: 'bold' },
    { token: 'header.csv', foreground: '6f4a00', fontStyle: 'bold' },
    { token: 'number', foreground: '7a3f00' },
  ];
}

function getMonacoThemeId() {
  var preset = getEditorThemeId();
  var mode = (typeof currentTheme !== 'undefined' && currentTheme === 'light') ? 'light' : 'dark';
  return 'sirius-' + mode + '-' + preset;
}

function updateMonacoTheme() {
  if (!monaco || !monaco.editor) return;
  try { monaco.editor.setTheme(getMonacoThemeId()); } catch (_) {}
}

function defineCustomThemes(m) {
  if (!m || !m.editor) return;
  var backgrounds = {
    dark: { bg: '0c0c0e', fg: 'd4d4d4', line: '6b7280' },
    light: { bg: 'f5f7fb', fg: '1f2937', line: '9ca3af' },
  };
  for (var i = 0; i < EDITOR_THEMES.length; i++) {
    var preset = EDITOR_THEMES[i].id;
    var rules = getThemeTokenRules(preset);
    m.editor.defineTheme('sirius-dark-' + preset, {
      base: 'vs-dark',
      inherit: true,
      rules: rules,
      colors: {
        'editor.background': '#' + backgrounds.dark.bg,
        'editor.foreground': '#' + backgrounds.dark.fg,
        'editor.selectionBackground': SELECTION_BG,
        'editorCursor.foreground': '#8ea0ff',
        'editorLineNumber.foreground': '#' + backgrounds.dark.line,
        'editorLineNumber.activeForeground': '#' + backgrounds.dark.fg,
      }
    });
    m.editor.defineTheme('sirius-light-' + preset, {
      base: 'vs',
      inherit: true,
      rules: rules.concat(getLightCsvAccentRules(preset)),
      colors: {
        'editor.background': '#' + backgrounds.light.bg,
        'editor.foreground': '#' + backgrounds.light.fg,
        'editor.selectionBackground': 'rgba(95,117,255,.16)',
        'editorCursor.foreground': '#3f51d9',
        'editorLineNumber.foreground': '#' + backgrounds.light.line,
        'editorLineNumber.activeForeground': '#' + backgrounds.light.fg,
      }
    });
  }
}

function registerCsvLanguage(m) {
  if (!m || !m.languages || _csvLanguageRegistered) return;
  _csvLanguageRegistered = true;
  m.languages.register({ id: 'csv' });
  m.languages.setMonarchTokensProvider('csv', {
    tokenizer: {
      root: [
        [/^([^,\t;\n"]+)(?=[,\t;\n]|$)/, 'header.csv'],
        [/"([^"\\]|\\.)*"/, 'string'],
        [/'([^'\\]|\\.)*'/, 'string'],
        [/[,\t;]/, 'delimiter.csv'],
        [/\b-?\d+(\.\d+)?\b/, 'number'],
        [/\b(true|false|null)\b/i, 'keyword'],
        [/#.*$/, 'comment'],
      ],
    },
  });
  m.languages.setLanguageConfiguration('csv', {
    comments: { lineComment: '#' },
    autoClosingPairs: [{ open: '"', close: '"' }, { open: "'", close: "'" }],
  });
}

// Подсказки: сниппеты + слова из документа + команды (всё локально)
var SNIPPETS_BY_LANG = {
  javascript: [
    { label: 'function', insert: 'function ${1:name}(${2:args}) {\n  ${3}\n}', detail: 'Объявление функции' },
    { label: 'arrow', insert: '(${1:args}) => ${2:expr}', detail: 'Стрелочная функция' },
    { label: 'if', insert: 'if (${1:condition}) {\n  ${2}\n}', detail: 'Условие if' },
    { label: 'for', insert: 'for (let ${1:i} = 0; ${1:i} < ${2:arr}.length; ${1:i}++) {\n  ${3}\n}', detail: 'Цикл for' },
    { label: 'foreach', insert: 'for (const ${1:item} of ${2:iterable}) {\n  ${3}\n}', detail: 'for…of' },
    { label: 'try', insert: 'try {\n  ${1}\n} catch (${2:err}) {\n  ${3}\n}', detail: 'try/catch' },
    { label: 'async', insert: 'async function ${1:name}(${2}) {\n  ${3}\n}', detail: 'async функция' },
    { label: 'console', insert: 'console.log(${1});', detail: 'Лог в консоль' },
    { label: 'return', insert: 'return ${1};', detail: 'return' },
  ],
  typescript: [
    { label: 'interface', insert: 'interface ${1:Name} {\n  ${2}\n}', detail: 'Интерфейс' },
    { label: 'type', insert: 'type ${1:Name} = ${2};', detail: 'Type alias' },
    { label: 'import', insert: "import { ${1} } from '${2}';", detail: 'Импорт' },
    { label: 'export', insert: 'export ${1};', detail: 'Экспорт' },
  ],
  python: [
    { label: 'def', insert: 'def ${1:name}(${2:args}):\n  ${3}', detail: 'Функция' },
    { label: 'class', insert: 'class ${1:Name}:\n  ${2}', detail: 'Класс' },
    { label: 'if', insert: 'if ${1:condition}:\n  ${2}', detail: 'Условие' },
    { label: 'for', insert: 'for ${1:item} in ${2:iterable}:\n  ${3}', detail: 'Цикл for' },
    { label: 'try', insert: 'try:\n  ${1}\nexcept ${2:Exception} as e:\n  ${3}', detail: 'try/except' },
    { label: 'with', insert: 'with ${1:expr} as ${2:var}:\n  ${3}', detail: 'with' },
    { label: 'lambda', insert: 'lambda ${1:x}: ${2}', detail: 'lambda' },
    { label: 'print', insert: 'print(${1})', detail: 'print' },
  ],
  html: [
    { label: 'div', insert: '<div>${1}</div>', detail: 'div' },
    { label: 'span', insert: '<span>${1}</span>', detail: 'span' },
    { label: 'a', insert: '<a href="${1}">${2}</a>', detail: 'Ссылка' },
    { label: 'img', insert: '<img src="${1}" alt="${2}" />', detail: 'Изображение' },
    { label: 'input', insert: '<input type="${1:text}" placeholder="${2}" />', detail: 'input' },
  ],
  css: [
    { label: 'flex', insert: 'display: flex;\njustify-content: ${1};\nalign-items: ${2};', detail: 'Flexbox' },
    { label: 'grid', insert: 'display: grid;\ngrid-template-columns: ${1};\ngap: ${2};', detail: 'Grid' },
    { label: 'media', insert: '@media (${1:min-width: 768px}) {\n  ${2}\n}', detail: 'Media query' },
  ],
  json: [
    { label: 'obj', insert: '"${1:key}": "${2:value}"', detail: 'Пара ключ-значение' },
  ],
  plaintext: [],
};
var COMMAND_SUGGESTIONS = [
  { label: 'TODO', insert: 'TODO: ', detail: 'Заметка' },
  { label: 'FIXME', insert: 'FIXME: ', detail: 'Исправить' },
  { label: 'NOTE', insert: 'NOTE: ', detail: 'Примечание' },
  { label: 'HACK', insert: 'HACK: ', detail: 'Временное решение' },
];

function registerSmartCompletions(m) {
  if (!m || !m.languages || !m.languages.registerCompletionItemProvider) return;
  var kinds = m.languages.CompletionItemKind;
  var insertRule = m.languages.CompletionItemInsertTextRule;
  var languages = ['javascript', 'typescript', 'python', 'html', 'css', 'json', 'markdown', 'plaintext', 'c', 'cpp', 'csharp', 'go', 'rust', 'java', 'ruby', 'php', 'shell', 'bat', 'sql', 'yaml', 'xml'];
  m.languages.registerCompletionItemProvider(languages, {
    triggerCharacters: ['.', '#', '/', ' ', '\t'],
    provideCompletionItems: function (model, position, context, token) {
      var word = model.getWordUntilPosition(position);
      var range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
      var prefix = (word.word || '').toLowerCase();
      var lang = model.getLanguageId && model.getLanguageId() || 'plaintext';
      var suggestions = [];
      var snippetList = SNIPPETS_BY_LANG[lang] || SNIPPETS_BY_LANG.plaintext || [];
      for (var i = 0; i < snippetList.length; i++) {
        var s = snippetList[i];
        if (prefix && s.label.toLowerCase().indexOf(prefix) !== 0) continue;
        suggestions.push({
          label: s.label,
          kind: kinds.Snippet,
          insertText: s.insert,
          insertTextRules: insertRule.InsertAsSnippet,
          range: range,
          detail: s.detail,
          sortText: '0' + s.label,
        });
      }
      var lineContent = model.getLineContent(position.lineNumber) || '';
      var lineStart = lineContent.match(/^\s*#?\s*/);
      if (lineStart) {
        for (var j = 0; j < COMMAND_SUGGESTIONS.length; j++) {
          var c = COMMAND_SUGGESTIONS[j];
          var cmdLabel = '#' + c.label;
          if (prefix && cmdLabel.toLowerCase().indexOf(prefix) !== 0) continue;
          suggestions.push({
            label: '#' + c.label,
            kind: kinds.Keyword,
            insertText: '#' + c.insert,
            range: range,
            detail: c.detail,
            sortText: '1' + c.label,
          });
        }
      }
      var text = model.getValue();
      var wordRegex = /[a-zA-Z_][a-zA-Z0-9_]*/g;
      var words = {};
      var match;
      while ((match = wordRegex.exec(text)) !== null) {
        var w = match[0];
        if (w.length >= 2 && w.length <= 40 && !words[w] && (prefix === '' || w.toLowerCase().indexOf(prefix) === 0)) words[w] = true;
      }
      var docWords = Object.keys(words);
      if (docWords.length > 200) docWords = docWords.slice(0, 200);
      for (var k = 0; k < docWords.length; k++) {
        var w = docWords[k];
        if (w === prefix) continue;
        suggestions.push({
          label: w,
          kind: kinds.Variable,
          insertText: w,
          range: range,
          detail: 'Из документа',
          sortText: '2' + w,
        });
      }
      return { suggestions: suggestions };
    },
  });
}

function initMonaco() {
  // Воркеры — тот же origin, что и страница (http://127.0.0.1:PORT), иначе не грузятся
  var workerBase;
  try {
    workerBase = new URL('../node_modules/monaco-editor/min/vs/', window.location.href).href;
    if (!workerBase.endsWith('/')) workerBase += '/';
  } catch (_) {
    workerBase = (typeof require !== 'undefined' && require.toUrl) ? require.toUrl('vs/') : '';
    if (workerBase && !workerBase.endsWith('/')) workerBase += '/';
  }
  if (typeof window !== 'undefined' && !window.MonacoEnvironment) {
    window.MonacoEnvironment = {
      getWorkerUrl: function (moduleId, label) {
        if (label === 'json') return workerBase + 'language/json/jsonWorker.js';
        if (label === 'css' || label === 'scss' || label === 'less') return workerBase + 'language/css/cssWorker.js';
        if (label === 'html' || label === 'handlebars' || label === 'razor') return workerBase + 'language/html/htmlWorker.js';
        if (label === 'typescript' || label === 'javascript') return workerBase + 'language/typescript/tsWorker.js';
        return workerBase + 'base/worker/workerMain.js';
      }
    };
  }

  var MONACO_TIMEOUT_MS = 25000;
  return new Promise(function (resolve, reject) {
    var settled = false;
    var timeoutId = setTimeout(function () {
      if (settled) return;
      settled = true;
      reject(new Error('Monaco не загрузился за ' + (MONACO_TIMEOUT_MS / 1000) + ' с. Проверьте консоль (F12).'));
    }, MONACO_TIMEOUT_MS);
    require(['vs/editor/editor.main'], function (m) {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      monaco = m;
      defineCustomThemes(monaco);
      registerCsvLanguage(monaco);
      var themeId = getMonacoThemeId();
      try { monaco.editor.setTheme(themeId); } catch (_) { monaco.editor.setTheme('sirius-dark-classic'); }
      editor = monaco.editor.create($('editor-wrap'), {
        value: '',
        language: 'plaintext',
        theme: themeId,
        fontSize: 14,
        fontFamily: "'Cascadia Code','Fira Code','JetBrains Mono',Consolas,monospace",
        fontLigatures: true,
        lineHeight: 22,
        minimap: { enabled: false },
        scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
        padding: { top: 12 },
        smoothScrolling: true,
        cursorSmoothCaretAnimation: 'on',
        renderLineHighlight: 'gutter',
        wordWrap: 'off',
        tabSize: 2,
        insertSpaces: true,
        formatOnType: false,
        formatOnPaste: false,
        automaticLayout: true,
        bracketPairColorization: { enabled: true },
        guides: { bracketPairs: true, indentation: true },
      });

      requestAnimationFrame(() => requestAnimationFrame(() => editor.layout()));
      try {
        const shouldSplit = localStorage.getItem('nb_editor_split') === '1';
        setEditorSplitEnabled(shouldSplit);
      } catch (_) {}

      editor.onDidChangeCursorPosition(e => {
        setStatusItem('sb-pos', `Ln ${e.position.lineNumber}, Col ${e.position.column}`);
      });
      editor.onDidChangeModelContent(() => {
        if (activeFile) {
          const c = editor.getValue();
          if (openFiles[activeFile]) {
            openFiles[activeFile].content = c;
            const wasModified = openFiles[activeFile].modified;
            const saved = openFiles[activeFile].savedContent ?? openFiles[activeFile].content;
            openFiles[activeFile].modified = (c !== saved);
            if (openFiles[activeFile].modified !== wasModified) refreshTabs();
          }
        }
      });

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, saveFile);
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyN, () => openFileModal(false));
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, function () {
        editor.focus();
        editor.getAction('actions.find').run();
      });
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, function () {
        editor.focus();
        editor.getAction('editor.action.startFindReplaceAction').run();
      });

      registerSmartCompletions(monaco);

      document.getElementById('editor-fallback')?.classList.remove('visible');
      var wrap = document.getElementById('editor-wrap');
      if (wrap) wrap.style.display = '';
      resolve();
    }, function (err) {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      if (err && err.requireType === 'scripterror') console.error('Monaco script load error:', err);
      reject(err || new Error('Monaco failed to load'));
    });
  });
}

function ensureSecondaryEditor() {
  if (!monaco || !editor || editorSecondary) return;
  const host = $('editor-wrap-2');
  if (!host) return;
  editorSecondary = monaco.editor.create(host, {
    value: '',
    language: 'plaintext',
    theme: getMonacoThemeId(),
    fontSize: 14,
    fontFamily: "'Cascadia Code','Fira Code','JetBrains Mono',Consolas,monospace",
    fontLigatures: true,
    lineHeight: 22,
    minimap: { enabled: false },
    scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
    padding: { top: 12 },
    smoothScrolling: true,
    cursorSmoothCaretAnimation: 'on',
    renderLineHighlight: 'gutter',
    wordWrap: 'off',
    tabSize: 2,
    insertSpaces: true,
    automaticLayout: true,
    bracketPairColorization: { enabled: true },
    guides: { bracketPairs: true, indentation: true },
  });
  const model = editor.getModel();
  if (model) editorSecondary.setModel(model);
}

function syncSplitEditorsModel() {
  if (!_editorSplitEnabled || !editor || !monaco) return;
  ensureSecondaryEditor();
  const host = $('editor-wrap-2');
  if (host) host.hidden = false;
  // Independent split mode: secondary keeps its own model/file when selected.
  if (!_secondaryFilePath) {
    const model = editor.getModel();
    if (editorSecondary) editorSecondary.setModel(model || null);
  }
  requestAnimationFrame(() => {
    try { editor.layout(); } catch (_) {}
    try { editorSecondary?.layout(); } catch (_) {}
  });
}

function clearSplitEditorsModel() {
  if (!editorSecondary) return;
  try { editorSecondary.setModel(null); } catch (_) {}
  _secondaryFilePath = null;
}

function setEditorSplitEnabled(v) {
  _editorSplitEnabled = !!v;
  try { localStorage.setItem('nb_editor_split', _editorSplitEnabled ? '1' : '0'); } catch (_) {}
  const content = $('editor-content');
  const host2 = $('editor-wrap-2');
  const btn = $('btn-split-editor');
  if (btn) btn.classList.toggle('active', _editorSplitEnabled);
  if (!content || !host2) return;
  content.classList.toggle('split-enabled', _editorSplitEnabled);
  host2.hidden = !_editorSplitEnabled;
  if (_editorSplitEnabled) {
    // Pick a different file for secondary pane when possible.
    if (!_secondaryFilePath || _secondaryFilePath === activeFile) {
      const alt = (openFilesOrder || []).find(function (p) { return p && p !== activeFile && openFiles[p]; });
      _secondaryFilePath = alt || null;
    }
    if (_secondaryFilePath) {
      setSecondaryEditorFile(_secondaryFilePath);
    } else {
      syncSplitEditorsModel();
    }
  }
  else requestAnimationFrame(() => { try { editor?.layout(); } catch (_) {} });
}

function toggleEditorSplit() {
  setEditorSplitEnabled(!_editorSplitEnabled);
}

function isEditorSplitEnabled() {
  return !!_editorSplitEnabled;
}

function setSecondaryEditorFile(filePath) {
  if (!filePath || !monaco || !editor) return false;
  if (!_editorSplitEnabled) setEditorSplitEnabled(true);
  ensureSecondaryEditor();
  if (!editorSecondary) return false;
  const content = openFiles[filePath]?.content;
  if (content == null) return false;
  const uri = monaco.Uri.file(filePath);
  let model = monaco.editor.getModel(uri);
  if (!model) model = monaco.editor.createModel(String(content), langOf(filePath), uri);
  else monaco.editor.setModelLanguage(model, langOf(filePath));
  editorSecondary.setModel(model);
  _secondaryFilePath = filePath;
  requestAnimationFrame(() => { try { editorSecondary.layout(); } catch (_) {} });
  return true;
}

function getSecondaryFilePath() {
  return _secondaryFilePath;
}

if (typeof window !== 'undefined') {
  window.toggleEditorSplit = toggleEditorSplit;
  window.setEditorSplitEnabled = setEditorSplitEnabled;
  window.isEditorSplitEnabled = isEditorSplitEnabled;
  window.syncSplitEditorsModel = syncSplitEditorsModel;
  window.clearSplitEditorsModel = clearSplitEditorsModel;
  window.setSecondaryEditorFile = setSecondaryEditorFile;
  window.getSecondaryFilePath = getSecondaryFilePath;
}
