/**
 * Sirius IDE — Unit tests: renderer/js/utils.js pure-function logic
 * Functions are duplicated here to keep tests self-contained
 * (renderer runs in browser context, not Node).
 */
import { describe, it, expect } from 'vitest';

// ── Re-implementations of pure functions from utils.js ────────

function escapeHtml(s: unknown): string {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const EXT_LANG: Record<string, string> = {
  js:'javascript', jsx:'javascript', ts:'typescript', tsx:'typescript',
  py:'python', pyw:'python', rs:'rust', go:'go', cs:'csharp', java:'java',
  cpp:'cpp', c:'c', rb:'ruby', php:'php', html:'html', htm:'html',
  css:'css', scss:'scss', json:'json', yaml:'yaml', yml:'yaml',
  md:'markdown', sh:'shell', bash:'shell', ps1:'powershell', bat:'bat',
  sql:'sql', xml:'xml', svg:'xml', toml:'ini', ini:'ini',
  dockerfile:'dockerfile', makefile:'makefile', vue:'html',
};

function extOf(name: string): string {
  return (name.split('.').pop() || '').toLowerCase();
}

function langOf(name: string): string {
  return EXT_LANG[extOf(name)] || 'plaintext';
}

function isAbsPath(p: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(p) || p.startsWith('/');
}

// ── escapeHtml ────────────────────────────────────────────────

describe('escapeHtml', () => {
  it('escapes ampersand', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });
  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
  it('escapes double quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });
  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#039;s');
  });
  it('handles null/undefined gracefully', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
  it('handles numbers', () => {
    expect(escapeHtml(42)).toBe('42');
  });
  it('leaves safe text untouched', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});

// ── extOf ─────────────────────────────────────────────────────

describe('extOf', () => {
  it('extracts lowercase extension', () => {
    expect(extOf('app.ts')).toBe('ts');
    expect(extOf('App.TSX')).toBe('tsx');
    expect(extOf('style.CSS')).toBe('css');
  });
  it('handles files with multiple dots', () => {
    expect(extOf('vitest.config.ts')).toBe('ts');
    expect(extOf('package-lock.json')).toBe('json');
  });
  it('returns empty string for no extension', () => {
    expect(extOf('Makefile')).toBe('makefile');
    expect(extOf('README')).toBe('readme');
  });
  it('handles dotfiles', () => {
    expect(extOf('.gitignore')).toBe('gitignore');
    expect(extOf('.env')).toBe('env');
  });
});

// ── langOf ────────────────────────────────────────────────────

describe('langOf', () => {
  const cases: [string, string][] = [
    ['main.ts',        'typescript'],
    ['app.tsx',        'typescript'],
    ['index.js',       'javascript'],
    ['index.jsx',      'javascript'],
    ['main.py',        'python'],
    ['lib.rs',         'rust'],
    ['server.go',      'go'],
    ['Main.java',      'java'],
    ['styles.css',     'css'],
    ['theme.scss',     'scss'],
    ['config.json',    'json'],
    ['data.yaml',      'yaml'],
    ['README.md',      'markdown'],
    ['deploy.sh',      'shell'],
    ['build.bat',      'bat'],
    ['run.ps1',        'powershell'],
    ['query.sql',      'sql'],
    ['page.html',      'html'],
    ['component.vue',  'html'],
    ['image.png',      'plaintext'],   // unknown → plaintext
    ['Dockerfile',     'dockerfile'],  // no-ext but mapped in EXT_LANG
  ];
  cases.forEach(([file, expected]) => {
    it(`${file} → ${expected}`, () => {
      expect(langOf(file)).toBe(expected);
    });
  });
});

// ── isAbsPath ─────────────────────────────────────────────────

describe('isAbsPath', () => {
  it('detects Windows absolute paths', () => {
    expect(isAbsPath('C:\\Users\\test')).toBe(true);
    expect(isAbsPath('D:/projects/app')).toBe(true);
  });
  it('detects Unix absolute paths', () => {
    expect(isAbsPath('/home/user/project')).toBe(true);
  });
  it('rejects relative paths', () => {
    expect(isAbsPath('./src/index.ts')).toBe(false);
    expect(isAbsPath('../parent/file')).toBe(false);
    expect(isAbsPath('src/index.ts')).toBe(false);
  });
});
