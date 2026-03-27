/* Sirius IDE — search.js */
'use strict';

function setupSearch() {
  const input = $('search-input');
  const results = $('search-results');
  const btnCase  = $('sf-case');
  const btnWord  = $('sf-word');
  const btnRegex = $('sf-regex');

  let caseSensitive = false;
  let wholeWord     = false;
  let useRegex      = false;
  let timeout = null;
  let searchDecoIds = [];
  let searchFlashTimer = null;
  let fallbackFlashTimer = null;

  function toggleFilter(btn, key) {
    const val = !{ caseSensitive, wholeWord, useRegex }[key];
    if (key === 'caseSensitive') caseSensitive = val;
    if (key === 'wholeWord')     wholeWord     = val;
    if (key === 'useRegex')      useRegex      = val;
    btn && btn.classList.toggle('active', val);
    scheduleSearch();
  }

  btnCase  && btnCase.addEventListener('click',  () => toggleFilter(btnCase,  'caseSensitive'));
  btnWord  && btnWord.addEventListener('click',  () => toggleFilter(btnWord,  'wholeWord'));
  btnRegex && btnRegex.addEventListener('click', () => toggleFilter(btnRegex, 'useRegex'));

  function scheduleSearch() {
    clearTimeout(timeout);
    timeout = setTimeout(() => runSearch(input.value.trim()), 300);
  }

  input.addEventListener('input', scheduleSearch);
  input.addEventListener('keydown', e => {
    if (e.altKey && e.key === 'c') { e.preventDefault(); toggleFilter(btnCase,  'caseSensitive'); }
    if (e.altKey && e.key === 'w') { e.preventDefault(); toggleFilter(btnWord,  'wholeWord'); }
    if (e.altKey && e.key === 'r') { e.preventDefault(); toggleFilter(btnRegex, 'useRegex'); }
  });

  function buildSearchRe(q) {
    try {
      let pattern = useRegex ? q : q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (wholeWord) pattern = '\\b' + pattern + '\\b';
      const flags = 'g' + (caseSensitive ? '' : 'i');
      return new RegExp(pattern, flags);
    } catch (_) {
      return null;
    }
  }

  async function runSearch(q) {
    results.innerHTML = '';
    if (!q || !projectRoot) return;
    const re = buildSearchRe(q);
    if (!re) {
      results.innerHTML = '<div class="search-result-file" style="color:var(--c-danger)">Неверное выражение</div>';
      return;
    }
    const matches = [];
    await searchInDir(projectRoot, re, matches, 0);
    if (!matches.length) {
      results.innerHTML = '<div class="search-result-file" style="opacity:.55;padding:10px 12px;font-size:12px">Ничего не найдено</div>';
      return;
    }
    let lastFile = null;
    for (const m of matches.slice(0, 200)) {
      if (m.file !== lastFile) {
        lastFile = m.file;
        const fh = document.createElement('div');
        fh.className = 'search-result-file';
        fh.textContent = m.file.replace(projectRoot, '').replace(/^[\\/]/, '');
        results.append(fh);
      }
      const item = document.createElement('div');
      item.className = 'search-result-item';
      const lineNo = document.createElement('span');
      lineNo.style.cssText = 'color:var(--c-text-dim);margin-right:8px;font-family:var(--font-mono);font-size:11px;flex-shrink:0;';
      lineNo.textContent = String(m.lineNo);
      item.appendChild(lineNo);
      const text = String(m.line || '');
      const lineRe = buildSearchRe(q);
      let last = 0;
      let match;
      if (lineRe) {
        while ((match = lineRe.exec(text)) !== null) {
          if (match.index > last) item.append(document.createTextNode(text.slice(last, match.index)));
          const mark = document.createElement('span');
          mark.className = 'search-match';
          mark.textContent = match[0];
          item.append(mark);
          last = match.index + match[0].length;
          if (match[0].length === 0) lineRe.lastIndex++;
        }
      }
      if (last < text.length) item.append(document.createTextNode(text.slice(last)));
      item.addEventListener('click', async () => {
        await openFile(m.file);
        highlightSearchResult(m, q);
      });
      results.append(item);
    }
    if (matches.length > 200) {
      const more = document.createElement('div');
      more.className = 'search-result-file';
      more.style.cssText = 'opacity:.5;padding:6px 12px;font-size:11px;';
      more.textContent = `…ещё ${matches.length - 200} совпадений`;
      results.append(more);
    }
  }

  function highlightSearchResult(match, query) {
    const q = String(query || '').trim();
    if (!q) return;
    const lineNo = Math.max(1, Number(match?.lineNo) || 1);

    if (editor && monaco && typeof editor.getModel === 'function') {
      const model = editor.getModel();
      if (!model) return;
      const maxLine = model.getLineCount();
      const safeLine = Math.min(lineNo, maxLine);
      const lineText = model.getLineContent(safeLine) || '';
      const idx = lineText.toLowerCase().indexOf(q.toLowerCase());
      const startCol = idx >= 0 ? idx + 1 : 1;
      const endCol = idx >= 0 ? startCol + q.length : Math.max(2, lineText.length + 1);

      editor.revealLineInCenter(safeLine);
      editor.setSelection(new monaco.Range(safeLine, startCol, safeLine, endCol));

      if (searchFlashTimer) clearTimeout(searchFlashTimer);
      searchDecoIds = editor.deltaDecorations(searchDecoIds, [
        {
          range: new monaco.Range(safeLine, 1, safeLine, 1),
          options: { isWholeLine: true, className: 'search-hit-line' },
        },
        {
          range: new monaco.Range(safeLine, startCol, safeLine, endCol),
          options: { inlineClassName: 'search-hit-word' },
        },
      ]);
      searchFlashTimer = setTimeout(() => {
        searchDecoIds = editor.deltaDecorations(searchDecoIds, []);
      }, 1800);
      return;
    }

    const fallback = document.getElementById('editor-fallback');
    if (fallback && fallback.classList.contains('visible')) {
      const content = String(openFiles[activeFile]?.content || fallback.value || '');
      const lines = content.split('\n');
      const safeLine = Math.min(lineNo, Math.max(1, lines.length));
      let offset = 0;
      for (let i = 0; i < safeLine - 1; i++) offset += lines[i].length + 1;
      const lineText = lines[safeLine - 1] || '';
      const idx = lineText.toLowerCase().indexOf(q.toLowerCase());
      const start = offset + (idx >= 0 ? idx : 0);
      const end = start + (idx >= 0 ? q.length : lineText.length);
      fallback.focus();
      fallback.setSelectionRange(start, end);
      fallback.classList.add('search-fallback-flash');
      if (fallbackFlashTimer) clearTimeout(fallbackFlashTimer);
      fallbackFlashTimer = setTimeout(() => fallback.classList.remove('search-fallback-flash'), 900);
    }
  }

  async function searchInDir(dir, re, matches, depth) {
    if (depth > 4) return;
    let entries;
    try { entries = await window.api.readDir(dir); } catch (_) { return; }
    const SKIP = new Set(['node_modules', '.git', '.svn', 'dist', 'build', '__pycache__', '.cache']);
    const TEXT_EXTS = new Set(['js','ts','jsx','tsx','mjs','cjs','py','pyw','css','scss','sass','less',
      'html','htm','json','jsonc','yaml','yml','md','mdx','txt','rs','go','java','kt',
      'cpp','c','h','hpp','php','rb','sh','bash','zsh','ps1','bat','cmd','sql','xml',
      'toml','ini','env','vue','svelte','dockerfile','makefile']);
    for (const e of entries) {
      if (e.name.startsWith('.') || SKIP.has(e.name)) continue;
      if (e.isDirectory) { await searchInDir(e.path, re, matches, depth + 1); }
      else {
        const ext = extOf(e.name);
        if (TEXT_EXTS.has(ext)) {
          try {
            const content = await window.api.readFile(e.path);
            const lines = content.split('\n');
            re.lastIndex = 0;
            lines.forEach((line, i) => {
              re.lastIndex = 0;
              if (re.test(line)) {
                matches.push({ file: e.path, line: line.trim().slice(0, 140), lineNo: i + 1 });
              }
            });
          } catch (_) {}
        }
      }
    }
  }
}
