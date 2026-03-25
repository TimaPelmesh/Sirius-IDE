/* Sirius IDE — workspaceService.js
   Extracted workspace switch + permission UX logic from fileTree.js */
'use strict';

let _workspaceSwitchSeq = 0;
let _accessHintShownForRoot = null;
let _workspaceWritable = null;

function isPermissionError(err) {
  const m = String(err?.message || err || '').toLowerCase();
  return m.includes('eperm') || m.includes('eacces') || m.includes('access is denied') || m.includes('нет прав');
}

function showPermissionRecoveryHint(targetPath) {
  const root = projectRoot || '';
  if (_accessHintShownForRoot === root) return;
  _accessHintShownForRoot = root;
  UX.errorWithRecovery(
    'Не удалось записать в эту папку. Можно продолжить в режиме чтения или выдать доступ.',
    'Исправить доступ',
    async () => {
      const dir = root || targetPath?.replace(/[\\/][^\\/]+$/, '');
      if (!dir) return;
      const t = UX.info('Пробуем запросить доступ…', 0);
      try {
        const ok = await window.api.fixFolderPermissions?.(dir);
        t.remove();
        UX.info(
          ok ? 'Запрос прав отправлен. Повторите сохранение.' : 'Не удалось открыть UAC. Можно работать с папкой в Documents.',
          5000
        );
      } catch (_) {
        t.remove();
        UX.info('Не удалось запросить доступ. Откройте проект из папки пользователя.', 5000);
      }
    },
    9000
  );
}

function handleWritePermissionError(err, targetPath, fallbackMsg) {
  if (!isPermissionError(err)) return false;
  _workspaceWritable = false;
  try { setStatusItem('sb-access', 'RO'); } catch (_) {}
  UX.error(fallbackMsg || 'Не удалось сохранить: у папки ограничен доступ.', 4500);
  showPermissionRecoveryHint(targetPath);
  return true;
}

async function detectWorkspaceWritable(rootPath) {
  if (!rootPath) return null;
  const testPath = rootPath.replace(/[\\/]$/, '') + '\\.sirius_access_probe_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  try {
    await window.api.writeFile(testPath, 'ok');
    await window.api.delete(testPath);
    return true;
  } catch (_) {
    return false;
  }
}

async function refreshWorkspaceAccessStatus(rootPath) {
  const ok = await detectWorkspaceWritable(rootPath);
  _workspaceWritable = ok;
  try { setStatusItem('sb-access', ok ? 'RW' : 'RO'); } catch (_) {}
  return ok;
}

async function openFolderFlow() {
  const result = await window.api.openFolderDialog();
  if (!result || !result.filePaths || !result.filePaths[0]) return;

  const folder = result.filePaths[0];
  const switchSeq = ++_workspaceSwitchSeq;

  try { await window.api.unwatchDir?.(); } catch (_) {}
  if (typeof setProjectRoot === 'function') setProjectRoot(folder);
  else projectRoot = folder;
  _accessHintShownForRoot = null;

  if (typeof replaceOpenFiles === 'function') replaceOpenFiles({});
  else openFiles = {};
  if (typeof setOpenFilesOrder === 'function') setOpenFilesOrder([]);
  else openFilesOrder = [];
  if (typeof setActiveFile === 'function') setActiveFile(null);
  else activeFile = null;
  selectedTreePaths.clear();
  expandedDirs.clear();
  if (editor) editor.setValue('');

  const tree = $('file-tree');
  if (tree) tree.innerHTML = '';

  await loadProject(true);
  // Proactive but silent access detection: status bar only, no scary popups.
  setStatusItem('sb-access', 'RW ?');
  refreshWorkspaceAccessStatus(folder).catch(() => {});

  // Extra refresh passes handle FS/watcher warm-up races on some systems.
  setTimeout(() => { if (switchSeq === _workspaceSwitchSeq) refreshTree().catch(() => {}); }, 120);
  setTimeout(() => { if (switchSeq === _workspaceSwitchSeq) refreshTree().catch(() => {}); }, 600);

  saveState();
  detectRunCommand();
}
