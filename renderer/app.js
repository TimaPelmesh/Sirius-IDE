/* Sirius IDE — app.js (init & wiring) */
'use strict';

window.addEventListener('DOMContentLoaded', async () => {
  applyTheme(currentTheme);
  if (window.api?._fallback) {
    toast('Запустите приложение через npm start (не в браузере)', 'error', 8000);
  }

  initWindowControls();
  loadChats();
  renderChatTabs();
  renderMessages();

  $('view-files').classList.add('active');
  $('ai-panel').classList.remove('hidden');
  $('sidebar').classList.remove('hidden');
  document.querySelectorAll('.ab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === 'files' || b.dataset.view === 'ai');
  });

  document.querySelectorAll('.ab-btn').forEach(btn => {
    btn.addEventListener('click', () => activateView(btn.dataset.view));
  });

  document.querySelectorAll('.ctx-item').forEach(item => {
    item.addEventListener('click', () => handleCtxAction(item.dataset.action));
  });
  document.addEventListener('click', () => hideCtxMenu());
  document.addEventListener('contextmenu', e => {
    if (!e.target.closest('.tree-item')) {
      if (projectRoot) {
        e.preventDefault();
        showCtxMenu(e.clientX, e.clientY, { path: projectRoot, isDir: true, name: '' });
      }
    }
  });

  $('btn-new-term').onclick = createTerminalTab;
  $('btn-clear-term').onclick = () => {
    const inst = termInstances.get(activeTermId);
    if (inst) inst.xterm.clear();
  };
  $('btn-close-term').onclick = () => $('term-panel').classList.remove('open');

  $('btn-open-folder').onclick = openFolder;
  const btnOpen2 = $('btn-open-folder2');
  if (btnOpen2) btnOpen2.onclick = openFolder;
  $('btn-new-file').onclick = () => openFileModal(false);
  $('btn-new-folder').onclick = () => openFileModal(true);
  $('btn-refresh').onclick = () => refreshTree();
  $('welcome-open-folder').onclick = openFolder;
  $('welcome-new-file').onclick = () => {
    if (!projectRoot) { toast('Сначала откройте папку проекта', 'info'); return; }
    openFileModal(false);
  };

  $('modal-chat-ok').onclick = applyRenameChat;
  $('modal-chat-input').onkeydown = e => {
    if (e.key === 'Enter') applyRenameChat();
    if (e.key === 'Escape') closeModal('modal-chat-backdrop');
  };

  document.querySelectorAll('.modal-close, [data-modal]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.modal || el.closest('.modal-backdrop')?.id;
      if (id) closeModal(id);
    });
  });
  $('confirm-ok').onclick = () => closeModal('modal-confirm-backdrop');
  $('confirm-cancel').onclick = () => closeModal('modal-confirm-backdrop');

  $('btn-new-chat').onclick = createNewChat;
  $('ai-send').onclick = sendMessage;
  $('ai-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  $('ai-input').addEventListener('input', () => {
    const el = $('ai-input');
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  });

  $('btn-save-settings').onclick = () => {
    const val = $('settings-sysprompt').value.trim();
    localStorage.setItem('nb_sysprompt', val || DEFAULT_SYSPROMPT);
    const themeId = $('settings-editor-theme')?.value;
    if (themeId && typeof applyEditorTheme === 'function') applyEditorTheme(themeId);
    toast('Настройки сохранены', 'success', 2000);
  };
  $('btn-reset-settings').onclick = () => {
    localStorage.removeItem('nb_sysprompt');
    $('settings-sysprompt').value = DEFAULT_SYSPROMPT;
    if (typeof applyEditorTheme === 'function') applyEditorTheme('vs-dark');
    var sel = $('settings-editor-theme');
    if (sel) sel.value = 'vs-dark';
    toast('Системный промт и тема редактора сброшены', 'info', 2000);
  };
  $('settings-sysprompt').value = getSystemPrompt();
  var themeSel = $('settings-editor-theme');
  if (themeSel && typeof getEditorThemeId === 'function') themeSel.value = getEditorThemeId();

  var btnRun = $('btn-run');
  if (btnRun) btnRun.onclick = runProject;
  $('sb-lm').onclick = fetchModels;

  document.querySelectorAll('.help-example').forEach(el => {
    el.addEventListener('click', () => {
      activateView('ai');
      const inp = $('ai-input');
      inp.value = el.textContent.trim().replace(/^[""]|[""]$/g, '');
      inp.style.height = 'auto';
      inp.style.height = Math.min(inp.scrollHeight, 140) + 'px';
      inp.focus();
    });
  });

  restorePanelSizes();
  initResizeHandles();
  initShortcuts();
  setupSearch();
  initMenuBar();

  window.api.onFsChange((event, changedPath) => {
    if (['add', 'unlink', 'addDir', 'unlinkDir'].includes(event)) {
      refreshTree();
    }
    if (event === 'change' && openFiles[changedPath] && !openFiles[changedPath].modified) {
      window.api.readFile(changedPath).then(content => {
        if (openFiles[changedPath]) {
          openFiles[changedPath].content = content;
          openFiles[changedPath].savedContent = content;
          if (changedPath === activeFile && editor && monaco) {
            const uri = monaco.Uri.file(changedPath);
            const model = monaco.editor.getModel(uri);
            if (model) model.setValue(content);
          }
        }
      }).catch(() => {});
    }
    if (event === 'unlink' && openFiles[changedPath]) {
      closeTab(changedPath);
      toast(`Файл удалён внешней программой: ${changedPath.split(/[\\/]/).pop()}`, 'info');
    }
  });

  startLmPoll();

  initMonaco().then(async () => {
    await restoreState();
    detectRunCommand();
  }).catch(err => {
    console.error('Monaco failed to load:', err);
    toast('Редактор не загрузился. Открываю консоль разработчика — смотрите вкладки Console и Network.', 'error', 10000);
    if (window.api?.openDevTools) window.api.openDevTools();
    restoreState().catch(() => {});
  });

  window.addEventListener('beforeunload', () => saveState());
  window.addEventListener('pagehide', () => saveState());
  setInterval(() => { if (projectRoot) saveState(); }, 3000);
});
