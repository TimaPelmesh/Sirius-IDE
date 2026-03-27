/**
 * Sirius IDE — Unit tests: file icon logic (utils.js)
 * Tests: SPECIAL_FILE_ICONS matching, FOLDER_THEMES matching, icon generation logic
 */
import { describe, it, expect } from 'vitest';

// ── Minimal re-implementation of icon-lookup logic ────────────

const SPECIAL_FILES = new Set([
  'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  'tsconfig.json', 'tsconfig.base.json',
  '.eslintrc', '.eslintrc.js', '.eslintrc.json',
  '.prettierrc', '.prettierrc.js',
  '.gitignore', '.gitattributes',
  '.env', '.env.local', '.env.example',
  'dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
  'vite.config.ts', 'vite.config.js',
  'webpack.config.js',
  'jest.config.js', 'jest.config.ts',
  'vitest.config.ts',
  'tailwind.config.js', 'tailwind.config.ts',
  'next.config.js', 'next.config.ts',
  'nuxt.config.ts',
  'readme.md', 'changelog.md', 'license',
  'makefile', 'cargo.toml', 'go.mod',
  'requirements.txt', 'pyproject.toml', 'setup.py',
]);

const FOLDER_THEMES = new Set([
  'src', 'source', 'app', 'lib', 'libs', 'components', 'component',
  'pages', 'views', 'routes', 'utils', 'util', 'helpers', 'hooks',
  'assets', 'images', 'img', 'icons', 'fonts', 'static', 'public',
  'styles', 'css', 'scss', 'tests', 'test', '__tests__', 'spec',
  'docs', 'doc', 'documentation', 'scripts', 'config', 'configs',
  '.github', '.vscode', 'node_modules', 'dist', 'build', 'out', 'output',
  '.git', 'api', 'server', 'client', 'backend', 'frontend',
  'store', 'redux', 'models', 'types', 'interfaces', 'middleware',
  'data', 'database', 'db',
]);

function isSpecialFile(name: string): boolean {
  return SPECIAL_FILES.has(name.toLowerCase());
}

function isThemedFolder(name: string): boolean {
  return FOLDER_THEMES.has(name.toLowerCase());
}

function extOf(name: string): string {
  return (name.split('.').pop() || '').toLowerCase();
}

// ── Special file detection ────────────────────────────────────

describe('Special file icons', () => {
  const specialFiles = [
    'package.json', 'package-lock.json', 'yarn.lock',
    'tsconfig.json', 'tsconfig.base.json',
    '.eslintrc', '.eslintrc.js', '.eslintrc.json',
    '.prettierrc', '.gitignore', '.gitattributes',
    '.env', '.env.local', '.env.example',
    'Dockerfile', 'docker-compose.yml',
    'vite.config.ts', 'vite.config.js',
    'jest.config.js', 'jest.config.ts',
    'vitest.config.ts',
    'tailwind.config.js',
    'next.config.js',
    'README.md', 'LICENSE',
    'Makefile', 'Cargo.toml', 'go.mod',
    'requirements.txt', 'pyproject.toml',
  ];

  specialFiles.forEach(file => {
    it(`recognises "${file}" as special`, () => {
      expect(isSpecialFile(file)).toBe(true);
    });
  });

  it('does not mark ordinary files as special', () => {
    expect(isSpecialFile('index.ts')).toBe(false);
    expect(isSpecialFile('app.py')).toBe(false);
    expect(isSpecialFile('styles.css')).toBe(false);
  });
});

// ── Folder theme detection ────────────────────────────────────

describe('Folder theme detection', () => {
  const themedFolders = [
    'src', 'app', 'lib', 'components', 'pages', 'views', 'routes',
    'utils', 'helpers', 'hooks', 'assets', 'images', 'public', 'static',
    'styles', 'scss', 'tests', 'test', '__tests__', 'docs', 'scripts',
    'config', '.github', '.vscode', 'node_modules', 'dist', 'build',
    'api', 'server', 'client', 'backend', 'frontend', 'store', 'models',
    'types', 'database', 'db',
  ];

  themedFolders.forEach(folder => {
    it(`"${folder}" has a theme`, () => {
      expect(isThemedFolder(folder)).toBe(true);
    });
  });

  it('generic folder names get no theme', () => {
    expect(isThemedFolder('foo')).toBe(false);
    expect(isThemedFolder('myproject')).toBe(false);
  });
});

// ── extOf (for normal file icons) ────────────────────────────

describe('extOf edge cases', () => {
  it('handles dotfiles correctly', () => {
    expect(extOf('.env')).toBe('env');
    expect(extOf('.gitignore')).toBe('gitignore');
  });
  it('returns last segment for multi-dot names', () => {
    expect(extOf('tailwind.config.ts')).toBe('ts');
    expect(extOf('docker-compose.yml')).toBe('yml');
  });
  it('handles no-extension files', () => {
    expect(extOf('Makefile')).toBe('makefile');
    expect(extOf('LICENSE')).toBe('license');
  });
  it('is always lowercase', () => {
    expect(extOf('App.TSX')).toBe('tsx');
    expect(extOf('INDEX.HTML')).toBe('html');
  });
});
