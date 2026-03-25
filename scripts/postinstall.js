/* Sirius IDE postinstall:
   - patch node-pty gyp files
   - try to rebuild node-pty for Electron
   - do not hard-fail npm install if rebuild fails */
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

function runNode(scriptPath) {
  return spawnSync(process.execPath, [scriptPath], { stdio: 'inherit' });
}

function runNpx(args) {
  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  return spawnSync(npxCmd, args, { stdio: 'inherit' });
}

const patchScript = path.join(__dirname, 'patch-node-pty.js');
const patchRes = runNode(patchScript);
if (patchRes.status !== 0) {
  console.warn('[postinstall] patch-node-pty failed, continuing install.');
}

const rebuildRes = runNpx(['electron-rebuild', '-f', '-w', 'node-pty']);
if (rebuildRes.status !== 0) {
  console.warn('[postinstall] WARNING: node-pty rebuild failed.');
  console.warn('[postinstall] App installation continues, but terminal may be unavailable on this machine.');
}
