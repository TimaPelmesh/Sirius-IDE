/* Sirius IDE — editor.js */
'use strict';

var EDITOR_THEMES = [
  { id: 'vs-dark', name: 'Тёмная (VS Dark)' },
  { id: 'vs', name: 'Светлая (VS Light)' },
  { id: 'one-dark', name: 'One Dark' },
  { id: 'dracula', name: 'Dracula' },
  { id: 'nord', name: 'Nord' },
];

function getEditorThemeId() {
  return localStorage.getItem('nb_editor_theme') || 'vs-dark';
}

function applyEditorTheme(themeId) {
  if (!themeId) return;
  localStorage.setItem('nb_editor_theme', themeId);
  if (typeof monaco !== 'undefined' && monaco.editor) monaco.editor.setTheme(themeId);
}

var SELECTION_BG = 'rgba(79,70,229,.2)';

function defineCustomThemes(m) {
  if (!m || !m.editor) return;
  /* One Dark — классика, читаемая тёмная тема */
  m.editor.defineTheme('one-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'c678dd', fontStyle: 'bold' },
      { token: 'string', foreground: '98c379' },
      { token: 'number', foreground: 'd19a66' },
      { token: 'comment', foreground: '5c6370', fontStyle: 'italic' },
      { token: 'type', foreground: 'e5c07b' },
      { token: 'function', foreground: '61afef' },
      { token: 'variable', foreground: 'e06c75' },
    ],
    colors: {
      'editor.background': '#282c34',
      'editor.foreground': '#abb2bf',
      'editor.selectionBackground': SELECTION_BG,
      'editorCursor.foreground': '#528bff',
      'editorLineNumber.foreground': '#5c6370',
      'editorLineNumber.activeForeground': '#abb2bf',
    }
  });
  /* Dracula — контрастная, фиолетово-розовая */
  m.editor.defineTheme('dracula', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'ff79c6', fontStyle: 'bold' },
      { token: 'string', foreground: 'f1fa8c' },
      { token: 'number', foreground: 'bd93f9' },
      { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
      { token: 'type', foreground: '8be9fd' },
      { token: 'function', foreground: '50fa7b' },
      { token: 'variable', foreground: 'f8f8f2' },
    ],
    colors: {
      'editor.background': '#282a36',
      'editor.foreground': '#f8f8f2',
      'editor.selectionBackground': SELECTION_BG,
      'editorCursor.foreground': '#f8f8f0',
      'editorLineNumber.foreground': '#6272a4',
      'editorLineNumber.activeForeground': '#f8f8f2',
    }
  });
  /* Nord — холодная, спокойная сине-серая */
  m.editor.defineTheme('nord', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: '81a1c1', fontStyle: 'bold' },
      { token: 'string', foreground: 'a3be8c' },
      { token: 'number', foreground: 'b48ead' },
      { token: 'comment', foreground: '616e88', fontStyle: 'italic' },
      { token: 'type', foreground: '8fbcbb' },
      { token: 'function', foreground: '88c0d0' },
      { token: 'variable', foreground: 'd8dee9' },
    ],
    colors: {
      'editor.background': '#2e3440',
      'editor.foreground': '#d8dee9',
      'editor.selectionBackground': SELECTION_BG,
      'editorCursor.foreground': '#d8dee9',
      'editorLineNumber.foreground': '#4c566a',
      'editorLineNumber.activeForeground': '#d8dee9',
    }
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
      var themeId = (typeof currentTheme !== 'undefined' && currentTheme === 'light') ? 'vs' : (getEditorThemeId() || 'vs-dark');
      try { monaco.editor.setTheme(themeId); } catch (_) { monaco.editor.setTheme(currentTheme === 'light' ? 'vs' : 'vs-dark'); }
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
