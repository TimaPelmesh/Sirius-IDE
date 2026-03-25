/* Sirius IDE — utils.js */
'use strict';

function uid() { return Math.random().toString(36).slice(2, 10); }

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function toast(msg, type = 'info', ms = 3000, action = null) {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  if (action) {
    const textEl = document.createElement('span');
    textEl.textContent = String(msg || '');
    const btn = document.createElement('button');
    btn.className = 'toast-action';
    btn.textContent = String(action.label || '');
    btn.addEventListener('click', () => { t.remove(); action.fn(); });
    t.append(textEl, btn);
    ms = ms || 0;
  } else {
    t.textContent = String(msg || '');
  }
  document.getElementById('toasts').append(t);
  if (ms > 0) setTimeout(() => { if (t.isConnected) t.remove(); }, ms);
  return t;
}

function $(id) { return document.getElementById(id); }

// Window API fallback (when preload fails / not in Electron)
if (!window.api) {
  console.warn('Sirius IDE: window.api отсутствует. Запускайте через: npm start');
  window.api = {
    _fallback: true,
    readFile: async () => '',
    readFileSafe: async () => ({ content: '', error: 'API недоступен. Запустите через npm start.' }),
    writeFile: async () => {}, readDir: async () => [], exists: async () => false,
    mkdir: async () => {}, stat: async () => ({}),
    rename: async () => {}, delete: async () => {},
    openFolderDialog: async () => null,
    watchDir: async () => {}, unwatchDir: async () => {},
    onFsChange: () => () => {},
    gitStatus: async () => null,
    terminalCreate: async () => null,
    terminalCreateInCwd: async () => null,
    terminalWrite: async () => {}, terminalResize: async () => {},
    terminalKill: async () => {}, terminalOnData: () => () => {},
    openDevTools: () => {},
    newWindow: async () => {},
    winMinimize: () => {}, winMaximize: () => {}, winClose: () => {},
    winIsMaximized: async () => false, onMaximized: () => {},
  };
}

const EXT_LANG = {
  js:'javascript', jsx:'javascript', ts:'typescript', tsx:'typescript', mjs:'javascript', cjs:'javascript',
  py:'python', pyw:'python', pyi:'python',
  rs:'rust', go:'go', cs:'csharp', java:'java', kt:'kotlin', scala:'scala',
  cpp:'cpp', cc:'cpp', cxx:'cpp', c:'c', h:'cpp', hpp:'cpp',
  rb:'ruby', php:'php', pl:'perl', lua:'lua', r:'r', swift:'swift',
  html:'html', htm:'html', css:'css', scss:'scss', sass:'scss', less:'less',
  csv:'csv', tsv:'csv',
  json:'json', jsonc:'json', yaml:'yaml', yml:'yaml',
  md:'markdown', mdx:'markdown', sh:'shell', bash:'shell', zsh:'shell',
  ps1:'powershell', bat:'bat', cmd:'bat',
  sql:'sql', xml:'xml', xaml:'xml', svg:'xml', toml:'ini', ini:'ini',
  dockerfile:'dockerfile', makefile:'makefile', mk:'makefile',
  vue:'html', env:'ini',
};

const FILE_ICON_INFO = {
  js:   { bg:'#f0db4f', fg:'#323330', label:'JS'   },
  jsx:  { bg:'#61dafb', fg:'#20232a', label:'JSX'  },
  mjs:  { bg:'#f0db4f', fg:'#323330', label:'MJS'  },
  cjs:  { bg:'#323330', fg:'#f0db4f', label:'CJS'  },
  ts:   { bg:'#3178c6', fg:'#fff',    label:'TS'   },
  tsx:  { bg:'#3178c6', fg:'#61dafb', label:'TSX'  },
  py:   { bg:'#4b8bbe', fg:'#ffe873', label:'PY'   },
  pyw:  { bg:'#4b8bbe', fg:'#ffe873', label:'PY'   },
  pyi:  { bg:'#4b8bbe', fg:'#b8d4e8', label:'PYI'  },
  html: { bg:'#e34c26', fg:'#fff',    label:'HTML' },
  htm:  { bg:'#e34c26', fg:'#fff',    label:'HTM'  },
  vue:  { bg:'#42b883', fg:'#fff',    label:'VUE'  },
  css:  { bg:'#264de4', fg:'#fff',    label:'CSS'  },
  scss: { bg:'#cf649a', fg:'#fff',    label:'SCSS' },
  sass: { bg:'#cf649a', fg:'#fff',    label:'SASS' },
  less: { bg:'#1d365d', fg:'#fff',    label:'LESS' },
  json: { bg:'#cbcb41', fg:'#333',    label:'JSON' },
  jsonc:{ bg:'#cbcb41', fg:'#333',    label:'JSON' },
  yaml: { bg:'#cc1018', fg:'#fff',    label:'YAML' },
  yml:  { bg:'#cc1018', fg:'#fff',    label:'YML'  },
  md:   { bg:'#083fa1', fg:'#fff',    label:'MD'   },
  mdx:  { bg:'#083fa1', fg:'#fff',    label:'MDX'  },
  rs:   { bg:'#ce412b', fg:'#fff',    label:'RS'   },
  go:   { bg:'#00add8', fg:'#fff',    label:'GO'   },
  java: { bg:'#ea2d2e', fg:'#fff',    label:'JV'   },
  kt:   { bg:'#a97bff', fg:'#fff',    label:'KT'   },
  php:  { bg:'#8892be', fg:'#fff',    label:'PHP'  },
  rb:   { bg:'#cc342d', fg:'#fff',    label:'RB'   },
  cs:   { bg:'#9b4f96', fg:'#fff',    label:'C#'   },
  cpp:  { bg:'#004482', fg:'#fff',    label:'C++'  },
  c:    { bg:'#555',    fg:'#fff',    label:'C'    },
  h:    { bg:'#a074c4', fg:'#fff',    label:'H'    },
  hpp:  { bg:'#004482', fg:'#fff',    label:'H++'  },
  sh:   { bg:'#89e051', fg:'#333',    label:'SH'   },
  bash: { bg:'#89e051', fg:'#333',    label:'SH'   },
  zsh:  { bg:'#89e051', fg:'#333',    label:'ZSH'  },
  bat:  { bg:'#2d2d2d', fg:'#0cf',    label:'BAT'  },
  cmd:  { bg:'#2d2d2d', fg:'#0cf',    label:'CMD'  },
  ps1:  { bg:'#012456', fg:'#fff',    label:'PS1'  },
  sql:  { bg:'#e38d13', fg:'#fff',    label:'SQL'  },
  xml:  { bg:'#f1a010', fg:'#fff',    label:'XML'  },
  xaml: { bg:'#512bd4', fg:'#fff',    label:'XAML' },
  toml: { bg:'#9c4221', fg:'#fff',    label:'TOML' },
  ini:  { bg:'#3d5a80', fg:'#fff',    label:'INI'  },
  env:  { bg:'#3d5a80', fg:'#98c379', label:'ENV'  },
  svg:  { bg:'#ff9900', fg:'#fff',    label:'SVG'  },
  csv:  { bg:'#2f7d32', fg:'#fff',    label:'CSV'  },
  tsv:  { bg:'#2f7d32', fg:'#fff',    label:'TSV'  },
  parquet:{ bg:'#3b2e7e', fg:'#fff',  label:'PQT'  },
  dockerfile:{ bg:'#2496ed', fg:'#fff', label:'DKR' },
  makefile:{ bg:'#2d2d2d', fg:'#f8f8f2', label:'MK'  },
  mk:   { bg:'#2d2d2d', fg:'#f8f8f2', label:'MK'   },
  txt:  { bg:'#888',    fg:'#fff',    label:'TXT'  },
};

function extOf(name) { return (name.split('.').pop() || '').toLowerCase(); }
function langOf(name) { return EXT_LANG[extOf(name)] || 'plaintext'; }

function getFileIcon(name, isDir) {
  if (isDir) {
    return `<svg class="ic file-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M1.5 4a1 1 0 0 1 1-1h3.5l1.5 1.5h7a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V4z" fill="#dcb862"/>
      <path d="M6 3v1.5h7" stroke="rgba(0,0,0,.2)" stroke-width="0.6" fill="none"/>
    </svg>`;
  }
  const ext = extOf(name);
  const info = FILE_ICON_INFO[ext];
  if (!info) {
    return `<svg class="ic file-icon" width="16" height="16" viewBox="0 0 16 16">
      <path d="M4 1.5L10 1v3.5h4V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2.5a1 1 0 0 1 1-1h1z" fill="var(--c-text-dim)" opacity=".6"/>
      <path d="M10 1v3.5h4" fill="none" stroke="var(--c-bg)" stroke-width="0.7"/>
    </svg>`;
  }
  var fs = info.label.length <= 2 ? 6 : info.label.length === 3 ? 5.2 : 4.2;
  return `<svg class="ic file-icon" width="16" height="16" viewBox="0 0 16 16">
    <path d="M3 1.5h7.2L14 5v9.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2.5a1 1 0 0 1 1-1z" fill="${info.bg}"/>
    <path d="M10.2 1v3.5H14" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="0.6"/>
    <path d="M10 1l4 4H10V1z" fill="rgba(0,0,0,.08)"/>
    <text x="8" y="10.2" text-anchor="middle" font-size="${fs}" font-weight="700" fill="${info.fg}" font-family="Consolas,'Cascadia Code',monospace" letter-spacing="-0.2">${info.label}</text>
  </svg>`;
}

function isAbsPath(p) { return /^[a-zA-Z]:[\\/]/.test(p) || p.startsWith('/'); }
