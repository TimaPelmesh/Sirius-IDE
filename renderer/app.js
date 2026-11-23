/* Sirius IDE — app.js (init & wiring) */
'use strict';

window.addEventListener('DOMContentLoaded', async () => {
  // ── Splash hard-kill: always fires regardless of init errors ──
  let _splashDone = false;
  function _killSplash(animate) {
    if (_splashDone) return;
    _splashDone = true;
    const sp = document.getElementById('splash');
    if (!sp) return;
    const ly = document.querySelector('.layout');
    if (ly) ly.classList.add('app-fade-in');
    sp.style.pointerEvents = 'none';   // never block clicks regardless of path
    if (animate !== false) sp.classList.add('splash-exit');
    else { sp.style.opacity = '0'; sp.style.transition = 'opacity .5s'; }
    try { localStorage.setItem('nb_splash_seen', '1'); } catch (_) {}
    setTimeout(() => {
      if (sp.parentNode) sp.parentNode.removeChild(sp);
      if (ly) ly.classList.remove('app-fade-in');
    }, 400);
  }
  function _shouldSkipSplash() {
    return localStorage.getItem('nb_splash_off') === '1';
  }
  // Skip only if user disabled splash in settings
  if (_shouldSkipSplash()) {
    _killSplash(false);
  }
  // Absolute guarantee: always closes within 2.5s
  setTimeout(() => _killSplash(true), 2500);

  applyTheme(currentTheme);
  if (window.api?._fallback) {
    toast('Запустите приложение через npm start (не в браузере)', 'error', 8000);
  }

  initWindowControls();
  loadChats();
  renderChatTabs();
  renderMessages();
  if (typeof renderAgentSessionBar === 'function') renderAgentSessionBar();
  if (typeof hydrateApiKeyFromVault === 'function') {
    hydrateApiKeyFromVault().then(function () {
      try {
        if (typeof applyProviderSelectUi === 'function' && typeof getLLMSettings === 'function') {
          applyProviderSelectUi(getLLMSettings());
        }
      } catch (_) {}
    }).catch(function () {});
  }
  const btnClearGoal = $('btn-clear-agent-goal');
  if (btnClearGoal) btnClearGoal.onclick = function () {
    if (typeof clearAgentGoal === 'function') clearAgentGoal();
  };

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
  const btnSplitEditor = $('btn-split-editor');
  if (btnSplitEditor) btnSplitEditor.onclick = () => window.toggleEditorSplit?.();
  const btnSplitTerm = $('btn-split-term');
  if (btnSplitTerm) btnSplitTerm.onclick = () => window.toggleTerminalSplit?.();
  $('btn-clear-term').onclick = () => {
    const inst = termInstances.get(activeTermId);
    if (inst) inst.xterm.clear();
  };
  const btnPasteTerm = $('btn-paste-term');
  if (btnPasteTerm) {
    btnPasteTerm.onclick = () => {
      const inst = termInstances.get(activeTermId);
      if (inst && typeof inst.pasteIntoTerm === 'function') inst.pasteIntoTerm();
      else if (typeof toast === 'function') toast('Открой терминал', 'info', 1500);
    };
  }
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

  // Splash toggle
  const splashChk = $('settings-splash-enabled');
  if (splashChk) {
    splashChk.checked = localStorage.getItem('nb_splash_off') !== '1';
    splashChk.addEventListener('change', () => {
      localStorage.setItem('nb_splash_off', splashChk.checked ? '0' : '1');
      if (splashChk.checked) try { localStorage.removeItem('nb_splash_seen'); } catch (_) {}
    });
  }

  $('btn-save-settings').onclick = () => {
    const val = $('settings-sysprompt').value.trim();
    localStorage.setItem('nb_sysprompt', val || DEFAULT_SYSPROMPT);
    const lang = $('settings-ui-language')?.value || 'ru';
    if (typeof applyUILanguage === 'function') applyUILanguage(lang);
    const syntaxTheme = $('settings-syntax-theme')?.value || 'classic';
    if (typeof applyEditorTheme === 'function') applyEditorTheme(syntaxTheme);
    if (splashChk) localStorage.setItem('nb_splash_off', splashChk.checked ? '0' : '1');
    toast('Настройки сохранены', 'success', 2000);
  };
  $('btn-reset-settings').onclick = () => {
    localStorage.removeItem('nb_sysprompt');
    $('settings-sysprompt').value = DEFAULT_SYSPROMPT;
    localStorage.removeItem('nb_lang');
    localStorage.removeItem('nb_editor_theme');
    localStorage.removeItem('nb_splash_off');
    try { localStorage.removeItem('nb_splash_seen'); } catch (_) {}
    var langSel = $('settings-ui-language');
    if (langSel) langSel.value = 'ru';
    var syntaxSel = $('settings-syntax-theme');
    if (syntaxSel) syntaxSel.value = 'classic';
    if (splashChk) splashChk.checked = true;
    if (typeof applyEditorTheme === 'function') applyEditorTheme('classic');
    if (typeof applyUILanguage === 'function') applyUILanguage('ru');
    toast('Настройки сброшены', 'info', 2000);
  };
  $('settings-sysprompt').value = getSystemPrompt();
  var langSel = $('settings-ui-language');
  if (langSel) langSel.value = (typeof currentLang === 'string' ? currentLang : 'ru');
  var syntaxSel = $('settings-syntax-theme');
  if (syntaxSel && typeof getEditorThemeId === 'function') syntaxSel.value = getEditorThemeId();
  // Live preview: apply theme immediately on select change (no need to click Save)
  if (syntaxSel) {
    syntaxSel.addEventListener('change', () => {
      if (typeof applyEditorTheme === 'function') applyEditorTheme(syntaxSel.value);
    });
  }

  // Sync dropdown to current stored theme every time settings opens.
  // Prevents stale select value from overwriting a good stored theme on Save.
  document.addEventListener('sirius:settings-open', () => {
    const sel = $('settings-syntax-theme');
    if (sel && typeof getEditorThemeId === 'function') {
      sel.value = getEditorThemeId();
    }
    const splashToggle = $('settings-splash-enabled');
    if (splashToggle) splashToggle.checked = localStorage.getItem('nb_splash_off') !== '1';
  });
  if (typeof applyUILanguage === 'function') applyUILanguage(typeof currentLang === 'string' ? currentLang : 'ru');

  const settingsScreen = $('settings-screen');
  const closeSettingsBtn = $('btn-close-settings');
  if (closeSettingsBtn) closeSettingsBtn.onclick = () => activateView('settings');
  if (settingsScreen) {
    const card = settingsScreen.querySelector('.settings-card');
    if (card) {
      card.addEventListener('click', (e) => e.stopPropagation());
      card.addEventListener('mousedown', (e) => e.stopPropagation());
    }
    // Backdrop click closes; clicks inside the card never collapse mid-edit
    settingsScreen.addEventListener('click', (e) => {
      if (e.target === settingsScreen) activateView('settings');
    });
  }

  const securityScreen = $('security-screen');
  const closeSecurityBtn = $('btn-close-security');
  const refreshSecurityBtn = $('btn-security-refresh');
  const clearSecurityBtn = $('btn-security-clear');
  if (closeSecurityBtn) closeSecurityBtn.onclick = () => activateView('security');
  if (refreshSecurityBtn) refreshSecurityBtn.onclick = () => {
    if (typeof renderSecurityJournal === 'function') renderSecurityJournal();
  };
  if (clearSecurityBtn) clearSecurityBtn.onclick = async () => {
    var ok = true;
    if (typeof showConfirm === 'function') {
      ok = await showConfirm('Очистить журнал AI-операций?', { title: 'Security', okText: 'Очистить', cancelText: 'Отмена', danger: true });
    }
    if (!ok) return;
    if (typeof window.clearAiOperationJournal === 'function') window.clearAiOperationJournal();
    if (typeof renderSecurityJournal === 'function') renderSecurityJournal();
    toast('AI журнал очищен', 'info', 1800);
  };
  if (securityScreen) {
    securityScreen.addEventListener('click', (e) => {
      if (e.target === securityScreen) activateView('security');
    });
  }

  // Move existing help content into centered help screen (single source of truth).
  const helpScreenBody = $('help-screen-body');
  const helpPanelContent = document.querySelector('#view-help .help-content');
  if (helpScreenBody && helpPanelContent) helpScreenBody.appendChild(helpPanelContent);
  const helpPanel = $('view-help');
  if (helpPanel) helpPanel.style.display = 'none';
  const helpScreen = $('help-screen');
  const closeHelpBtn = $('btn-close-help');
  if (closeHelpBtn) closeHelpBtn.onclick = () => activateView('help');
  if (helpScreen) {
    helpScreen.addEventListener('click', (e) => {
      if (e.target === helpScreen) activateView('help');
    });
  }

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

  // Quick action buttons — fill AI input and focus
  document.querySelectorAll('.ai-qa-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const prompt = btn.dataset.prompt;
      if (!prompt) return;
      const inp = $('ai-input');
      inp.value = prompt;
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

  // ── Splash status line (short cycle) ───────────────────────
  const SPLASH_MSGS = ['Инициализация…', 'Загрузка редактора…', 'Готово…'];
  (() => {
    const msgEl = document.getElementById('splash-msg');
    if (!msgEl || _shouldSkipSplash()) return;
    let idx = 0;
    const iv = setInterval(() => {
      idx++;
      if (idx >= SPLASH_MSGS.length) { clearInterval(iv); return; }
      msgEl.style.opacity = '0';
      setTimeout(() => {
        msgEl.textContent = SPLASH_MSGS[idx];
        msgEl.style.opacity = '1';
      }, 120);
    }, 450);
  })();

  const _splashStart = Date.now();
  const SPLASH_MAX_MS = 1600;
  function dismissSplash() {
    const sp = document.getElementById('splash');
    if (sp) sp.style.pointerEvents = 'none';
    if (_shouldSkipSplash()) {
      _killSplash(false);
      return;
    }
    const elapsed = Date.now() - _splashStart;
    const wait = Math.max(0, SPLASH_MAX_MS - elapsed);
    setTimeout(_killSplash, wait);
  }

  initMonaco().then(async () => {
    dismissSplash();                 // dismiss as soon as editor is ready
    await restoreState();
    // Re-confirm the stored theme after restoreState (openFile / setModel calls
    // can trigger Monaco internal layout passes; re-setting the theme here ensures
    // the user's saved preference is always visible after all files are restored).
    if (typeof applyEditorTheme === 'function') {
      applyEditorTheme(typeof getEditorThemeId === 'function' ? getEditorThemeId() : 'classic');
    }
    detectRunCommand();
    if (typeof tryRestoreAgentSessionFromProject === 'function') {
      tryRestoreAgentSessionFromProject().catch(function () {});
    }
  }).catch(err => {
    console.error('Monaco failed to load:', err);
    dismissSplash();                 // dismiss even on failure
    toast('Редактор не загрузился. Открываю консоль разработчика — смотрите вкладки Console и Network.', 'error', 10000);
    if (window.api?.openDevTools) window.api.openDevTools();
    restoreState().catch(() => {}).then(function () {
      if (typeof tryRestoreAgentSessionFromProject === 'function') {
        return tryRestoreAgentSessionFromProject();
      }
    }).catch(function () {});
  });

  window.addEventListener('beforeunload', () => saveState());
  window.addEventListener('pagehide', () => saveState());
  setInterval(() => { if (projectRoot) saveState(); }, 3000);
});
