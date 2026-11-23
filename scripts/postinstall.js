/* Sirius IDE postinstall — keep npm install fast.
   Native rebuild is OPT-IN (slow: compiles node-pty for Electron).
   Run: npm run rebuild:native   or   set SIRIUS_REBUILD_NATIVE=1
*/
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function runNode(scriptPath) {
  return spawnSync(process.execPath, [scriptPath], { stdio: 'inherit' });
}

function runNpx(args) {
  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  return spawnSync(npxCmd, args, { stdio: 'inherit', shell: true });
}

const patchScript = path.join(__dirname, 'patch-node-pty.js');
if (fs.existsSync(patchScript)) {
  const patchRes = runNode(patchScript);
  if (patchRes.status !== 0) {
    console.warn('[postinstall] patch-node-pty failed, continuing.');
  }
}

const wantRebuild =
  process.env.SIRIUS_REBUILD_NATIVE === '1' ||
  process.env.SIRIUS_REBUILD_NATIVE === 'true' ||
  process.argv.includes('--rebuild-native');

if (!wantRebuild) {
  console.log('[postinstall] Skip electron-rebuild (fast install).');
  console.log('[postinstall] Terminal needs native module once: npm run rebuild:native');
  process.exit(0);
}

console.log('[postinstall] Rebuilding node-pty for Electron (may take several minutes)…');
const rebuildRes = runNpx(['electron-rebuild', '-f', '-w', 'node-pty']);
if (rebuildRes.status !== 0) {
  console.warn('[postinstall] WARNING: node-pty rebuild failed — terminal may not work.');
  console.warn('[postinstall] Install Visual Studio Build Tools (C++), then: npm run rebuild:native');
}
