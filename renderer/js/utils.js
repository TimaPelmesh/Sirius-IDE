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

// Special files that override the generic ext-based icon
const SPECIAL_FILE_ICONS = {
  'package.json':       { bg:'#cc3a10', fg:'#fff', label:'NPM' },
  'package-lock.json':  { bg:'#cc3a10', fg:'#fff', label:'NPM' },
  'yarn.lock':          { bg:'#2c8ebb', fg:'#fff', label:'YARN' },
  'pnpm-lock.yaml':     { bg:'#f69220', fg:'#fff', label:'PNP' },
  'tsconfig.json':      { bg:'#3178c6', fg:'#fff', label:'TSC' },
  'tsconfig.base.json': { bg:'#3178c6', fg:'#fff', label:'TSC' },
  '.eslintrc':          { bg:'#4b32c3', fg:'#fff', label:'ESL' },
  '.eslintrc.js':       { bg:'#4b32c3', fg:'#fff', label:'ESL' },
  '.eslintrc.json':     { bg:'#4b32c3', fg:'#fff', label:'ESL' },
  '.prettierrc':        { bg:'#f7b93e', fg:'#333', label:'PRT' },
  '.prettierrc.js':     { bg:'#f7b93e', fg:'#333', label:'PRT' },
  '.gitignore':         { bg:'#f05032', fg:'#fff', label:'GIT' },
  '.gitattributes':     { bg:'#f05032', fg:'#fff', label:'GIT' },
  '.env':               { bg:'#3d5a80', fg:'#98c379', label:'ENV' },
  '.env.local':         { bg:'#3d5a80', fg:'#98c379', label:'ENV' },
  '.env.example':       { bg:'#3d5a80', fg:'#98c379', label:'ENV' },
  'dockerfile':         { bg:'#2496ed', fg:'#fff', label:'DKR' },
  'docker-compose.yml': { bg:'#2496ed', fg:'#fff', label:'DKR' },
  'docker-compose.yaml':{ bg:'#2496ed', fg:'#fff', label:'DKR' },
  'vite.config.ts':     { bg:'#646cff', fg:'#fff', label:'VITE' },
  'vite.config.js':     { bg:'#646cff', fg:'#fff', label:'VITE' },
  'webpack.config.js':  { bg:'#8dd6f9', fg:'#1a252f', label:'WPK' },
  'jest.config.js':     { bg:'#c21325', fg:'#fff', label:'JEST' },
  'jest.config.ts':     { bg:'#c21325', fg:'#fff', label:'JEST' },
  'vitest.config.ts':   { bg:'#6e9f18', fg:'#fff', label:'VTT' },
  'tailwind.config.js': { bg:'#38bdf8', fg:'#fff', label:'TW' },
  'tailwind.config.ts': { bg:'#38bdf8', fg:'#fff', label:'TW' },
  'next.config.js':     { bg:'#000', fg:'#fff', label:'NXT' },
  'next.config.ts':     { bg:'#000', fg:'#fff', label:'NXT' },
  'nuxt.config.ts':     { bg:'#00dc82', fg:'#fff', label:'NXT' },
  'readme.md':          { bg:'#083fa1', fg:'#fff', label:'README' },
  'changelog.md':       { bg:'#083fa1', fg:'#fff', label:'CHG' },
  'license':            { bg:'#888', fg:'#fff', label:'LIC' },
  'makefile':           { bg:'#2d2d2d', fg:'#f8f8f2', label:'MK' },
  'cargo.toml':         { bg:'#ce412b', fg:'#fff', label:'CARGO' },
  'go.mod':             { bg:'#00add8', fg:'#fff', label:'MOD' },
  'requirements.txt':   { bg:'#4b8bbe', fg:'#ffe873', label:'REQ' },
  'pyproject.toml':     { bg:'#4b8bbe', fg:'#ffe873', label:'PYP' },
  'setup.py':           { bg:'#4b8bbe', fg:'#ffe873', label:'SET' },
};

// Folder color themes based on common names
const FOLDER_THEMES = {
  src:          '#4f8de8',
  source:       '#4f8de8',
  app:          '#4f8de8',
  lib:          '#7c6af7',
  libs:         '#7c6af7',
  components:   '#b87fff',
  component:    '#b87fff',
  pages:        '#e87d4f',
  views:        '#e87d4f',
  routes:       '#e87d4f',
  utils:        '#4fc1e9',
  util:         '#4fc1e9',
  helpers:      '#4fc1e9',
  hooks:        '#4fc1e9',
  assets:       '#62b87e',
  images:       '#62b87e',
  img:          '#62b87e',
  icons:        '#62b87e',
  fonts:        '#62b87e',
  static:       '#62b87e',
  public:       '#62b87e',
  styles:       '#cf649a',
  css:          '#264de4',
  scss:         '#cf649a',
  styles_css:   '#cf649a',
  tests:        '#f7b93e',
  test:         '#f7b93e',
  __tests__:    '#f7b93e',
  spec:         '#f7b93e',
  docs:         '#38bdf8',
  doc:          '#38bdf8',
  documentation:'#38bdf8',
  scripts:      '#e87d4f',
  config:       '#9ca3af',
  configs:      '#9ca3af',
  '.github':    '#f05032',
  '.vscode':    '#0078d7',
  node_modules: '#5a6270',
  dist:         '#5a6270',
  build:        '#5a6270',
  out:          '#5a6270',
  output:       '#5a6270',
  '.git':       '#f05032',
  api:          '#4fc1e9',
  server:       '#62b87e',
  client:       '#4f8de8',
  backend:      '#62b87e',
  frontend:     '#4f8de8',
  store:        '#e87d4f',
  redux:        '#764abc',
  models:       '#e87d4f',
  types:        '#3178c6',
  interfaces:   '#3178c6',
  middleware:   '#9ca3af',
  data:         '#cbcb41',
  database:     '#cbcb41',
  db:           '#cbcb41',
};

function getFileIcon(name, isDir) {
  if (isDir) {
    const key = name.toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
    const color = FOLDER_THEMES[name.toLowerCase()] || FOLDER_THEMES[key] || '#dcb862';
    const isSpecial = FOLDER_THEMES[name.toLowerCase()] !== undefined;
    const folderDark = isSpecial
      ? color.replace('#', '').match(/../g)?.map(x => Math.max(0, parseInt(x, 16) - 30).toString(16).padStart(2,'0')).join('')
      : 'b08820';
    const dc = isSpecial ? `#${folderDark}` : '#b08820';
    return `<svg class="ic file-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M1.5 4a1 1 0 0 1 1-1h3.5l1.5 1.5h7a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V4z" fill="${color}"/>
      <path d="M1.5 6.5h13" stroke="${dc}" stroke-width="0.5" opacity=".6"/>
    </svg>`;
  }
  // Check special files first (by full name, case-insensitive)
  const lname = name.toLowerCase();
  const specialInfo = SPECIAL_FILE_ICONS[lname];
  if (specialInfo) {
    var sfs = specialInfo.label.length <= 2 ? 6 : specialInfo.label.length === 3 ? 5.2 : 4.0;
    return `<svg class="ic file-icon" width="16" height="16" viewBox="0 0 16 16">
      <path d="M3 1.5h7.2L14 5v9.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2.5a1 1 0 0 1 1-1z" fill="${specialInfo.bg}"/>
      <path d="M10.2 1v3.5H14" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="0.6"/>
      <path d="M10 1l4 4H10V1z" fill="rgba(0,0,0,.1)"/>
      <text x="8" y="10.2" text-anchor="middle" font-size="${sfs}" font-weight="700" fill="${specialInfo.fg}" font-family="Consolas,'Cascadia Code',monospace" letter-spacing="-0.2">${specialInfo.label}</text>
    </svg>`;
  }
  const ext = extOf(name);
  const info = FILE_ICON_INFO[ext];
  if (!info) {
    return `<svg class="ic file-icon" width="16" height="16" viewBox="0 0 16 16">
      <path d="M4 1.5L10 1v3.5h4V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2.5a1 1 0 0 1 1-1h1z" fill="var(--c-text-dim)" opacity=".5"/>
      <path d="M10 1v3.5h4" fill="none" stroke="var(--c-bg)" stroke-width="0.7"/>
    </svg>`;
  }
  var fs = info.label.length <= 2 ? 6 : info.label.length === 3 ? 5.2 : 4.2;
  return `<svg class="ic file-icon" width="16" height="16" viewBox="0 0 16 16">
    <path d="M3 1.5h7.2L14 5v9.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2.5a1 1 0 0 1 1-1z" fill="${info.bg}"/>
    <path d="M10.2 1v3.5H14" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="0.6"/>
    <path d="M10 1l4 4H10V1z" fill="rgba(0,0,0,.08)"/>
    <text x="8" y="10.2" text-anchor="middle" font-size="${fs}" font-weight="700" fill="${info.fg}" font-family="Consolas,'Cascadia Code',monospace" letter-spacing="-0.2">${info.label}</text>
  </svg>`;
}

function isAbsPath(p) { return /^[a-zA-Z]:[\\/]/.test(p) || p.startsWith('/'); }
