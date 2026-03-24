/* Sirius IDE — search.js */
'use strict';

function setupSearch() {
  const input = $('search-input');
  const results = $('search-results');
  let timeout = null;
  let searchDecoIds = [];
  let searchFlashTimer = null;
  let fallbackFlashTimer = null;
  input.addEventListener('input', () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => runSearch(input.value.trim()), 300);
  });

  async function runSearch(q) {
    results.innerHTML = '';
    if (!q || !projectRoot) return;
    const matches = [];
    await searchInDir(projectRoot, q.toLowerCase(), matches, 0);
    if (!matches.length) { results.innerHTML = '<div class="search-result-file">Нет результатов</div>'; return; }
    let lastFile = null;
    for (const m of matches.slice(0, 100)) {
      if (m.file !== lastFile) {
        lastFile = m.file;
        const fh = document.createElement('div');
        fh.className = 'search-result-file';
        fh.textContent = m.file.replace(projectRoot, '').replace(/^[\\/]/, '');
        results.append(fh);
      }
      const item = document.createElement('div');
      item.className = 'search-result-item';
      const hi = m.line.replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'gi'), s => `<span class="search-match">${s}</span>`);
      item.innerHTML = `<span style="color:var(--c-text-dim);margin-right:6px">${m.lineNo}</span>${hi}`;
      item.addEventListener('click', async () => {
        await openFile(m.file);
        highlightSearchResult(m, q);
      });
      results.append(item);
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

  async function searchInDir(dir, q, matches, depth) {
    if (depth > 4) return;
    let entries;
    try { entries = await window.api.readDir(dir); } catch (_) { return; }
    for (const e of entries) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      if (e.isDirectory) { await searchInDir(e.path, q, matches, depth + 1); }
      else {
        const ext = extOf(e.name);
        if (['js','ts','jsx','tsx','py','css','html','json','md','txt','rs','go'].includes(ext)) {
          try {
            const content = await window.api.readFile(e.path);
            const lines = content.split('\n');
            lines.forEach((line, i) => {
              if (line.toLowerCase().includes(q)) {
                matches.push({ file: e.path, line: line.trim().slice(0, 120), lineNo: i + 1 });
              }
            });
          } catch (_) {}
        }
      }
    }
  }
}
