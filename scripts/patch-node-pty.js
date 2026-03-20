/* Patch node-pty gyp files to disable Spectre requirement on Windows. */
'use strict';

const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '..', 'node_modules', 'node-pty', 'binding.gyp'),
  path.join(__dirname, '..', 'node_modules', 'node-pty', 'deps', 'winpty', 'src', 'winpty.gyp'),
];

function patchFile(filePath) {
  if (!fs.existsSync(filePath)) return { filePath, changed: false, reason: 'missing' };
  const src = fs.readFileSync(filePath, 'utf8');
  let out = src.replace(/^\s*'SpectreMitigation':\s*'Spectre'\s*,?\r?\n/gm, '');

  // Prevent node-gyp from adding win_delay_load_hook.cc on Windows.
  if (out.indexOf("'win_delay_load_hook': 'false'") === -1) {
    out = out.replace(
      /('target_defaults'\s*:\s*\{[\s\S]*?'conditions'\s*:\s*\[\s*\r?\n\s*\['OS=="win"',\s*\{\s*\r?\n)/m,
      "$1        'variables': {\n          'win_delay_load_hook': 'false'\n        },\n"
    );
  }

  // Fallback: inject variable at each target level too.
  out = out
    .replace(
      /('target_name'\s*:\s*'[^']+'\s*,\r?\n)(\s*)(?!'variables'\s*:)/g,
      "$1$2'variables': {\n$2  'win_delay_load_hook': 'false'\n$2},\n"
    );

  if (out === src) return { filePath, changed: false, reason: 'no-match' };
  fs.writeFileSync(filePath, out, 'utf8');
  return { filePath, changed: true, reason: 'patched' };
}

const results = files.map(patchFile);
for (const r of results) {
  const rel = path.relative(process.cwd(), r.filePath);
  if (r.changed) console.log('[patch-node-pty] patched:', rel);
  else console.log('[patch-node-pty] skipped:', rel, '(' + r.reason + ')');
}
