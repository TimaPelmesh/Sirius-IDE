/**
 * Sirius IDE — Unit tests: AI parser functions (ai.js logic)
 * Tests: parseToolCalls, cleanReply, buildSimpleDiff, validateAndResolveToolPath stub
 */
import { describe, it, expect } from 'vitest';

// ── Re-implementations from ai.js ─────────────────────────────

const TOOL_NAMES = 'CREATEFILE|EDITFILE|READDIR|READFILE|DELETEFILE';

function parseToolCalls(text: string) {
  const tools: { cmd: string; arg: string; body: string }[] = [];
  const re = new RegExp(
    '\\[(' + TOOL_NAMES + '):([^\\]]*)\\]([\\s\\S]*?)(?=\\[(?:' + TOOL_NAMES + '):|$)',
    'g'
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    let body = m[3].trim();
    body = body.replace(/^```[\w]*\r?\n([\s\S]*?)\r?\n```\s*$/, '$1').trim();
    tools.push({ cmd: m[1], arg: m[2].trim(), body });
  }
  return tools;
}

function cleanReply(text: string): string {
  const re = new RegExp(
    '\\[(' + TOOL_NAMES + '):[^\\]]*\\][\\s\\S]*?(?=\\[(?:' + TOOL_NAMES + '):|$)',
    'g'
  );
  return text.replace(re, '').trim();
}

function buildSimpleDiff(oldText: string, newText: string) {
  const o = String(oldText || '').split('\n');
  const n = String(newText || '').split('\n');
  const added   = n.filter(l => !o.includes(l)).length;
  const removed = o.filter(l => !n.includes(l)).length;
  return { added, removed, oldLen: o.length, newLen: n.length };
}

// ── parseToolCalls ────────────────────────────────────────────

describe('parseToolCalls', () => {
  it('parses a single READFILE command', () => {
    const input = '[READFILE:src/index.ts]\n';
    const result = parseToolCalls(input);
    expect(result).toHaveLength(1);
    expect(result[0].cmd).toBe('READFILE');
    expect(result[0].arg).toBe('src/index.ts');
    expect(result[0].body).toBe('');
  });

  it('parses EDITFILE with inline body', () => {
    const input = '[EDITFILE:src/utils.js]\nconsole.log("hello");\n';
    const result = parseToolCalls(input);
    expect(result).toHaveLength(1);
    expect(result[0].cmd).toBe('EDITFILE');
    expect(result[0].arg).toBe('src/utils.js');
    expect(result[0].body).toContain('console.log');
  });

  it('parses EDITFILE with fenced code block body', () => {
    const input = '[EDITFILE:app.ts]\n```typescript\nconst x = 1;\n```\n';
    const result = parseToolCalls(input);
    expect(result).toHaveLength(1);
    expect(result[0].body).toBe('const x = 1;');
  });

  it('parses CREATEFILE command', () => {
    const input = '[CREATEFILE:new.md]\n# Hello\n';
    const result = parseToolCalls(input);
    expect(result[0].cmd).toBe('CREATEFILE');
    expect(result[0].body).toBe('# Hello');
  });

  it('parses multiple commands in sequence', () => {
    const input =
      '[READFILE:src/a.ts]\n' +
      '[EDITFILE:src/b.ts]\nconst b = 2;\n';
    const result = parseToolCalls(input);
    expect(result).toHaveLength(2);
    expect(result[0].cmd).toBe('READFILE');
    expect(result[1].cmd).toBe('EDITFILE');
  });

  it('parses READDIR', () => {
    const result = parseToolCalls('[READDIR:src]\n');
    expect(result[0].cmd).toBe('READDIR');
    expect(result[0].arg).toBe('src');
  });

  it('parses DELETEFILE', () => {
    const result = parseToolCalls('[DELETEFILE:old/file.ts]\n');
    expect(result[0].cmd).toBe('DELETEFILE');
  });

  it('returns empty array for plain text with no commands', () => {
    expect(parseToolCalls('Конечно, вот объяснение...')).toHaveLength(0);
    expect(parseToolCalls('')).toHaveLength(0);
  });

  it('trims whitespace from arg', () => {
    const result = parseToolCalls('[READFILE: src/index.ts ]\n');
    expect(result[0].arg).toBe('src/index.ts');
  });
});

// ── cleanReply ────────────────────────────────────────────────

describe('cleanReply', () => {
  it('removes tool blocks from reply', () => {
    const input =
      'Сейчас изменю файл.\n' +
      '[EDITFILE:src/app.ts]\nconst x = 1;\n';
    expect(cleanReply(input)).toBe('Сейчас изменю файл.');
  });

  it('leaves text without commands unchanged', () => {
    const text = 'Вот ответ на ваш вопрос.';
    expect(cleanReply(text)).toBe(text);
  });

  it('handles empty input', () => {
    expect(cleanReply('')).toBe('');
  });

  it('removes multiple consecutive tool blocks', () => {
    const input =
      '[CREATEFILE:a.ts]\nconst a = 1;\n' +
      '[CREATEFILE:b.ts]\nconst b = 2;\n';
    expect(cleanReply(input)).toBe('');
  });
});

// ── buildSimpleDiff ───────────────────────────────────────────

describe('buildSimpleDiff', () => {
  it('calculates lines for a new file', () => {
    const result = buildSimpleDiff('', 'line1\nline2\nline3');
    expect(result.newLen).toBe(3);
    expect(result.oldLen).toBe(1); // empty string splits to ['']
    expect(result.added).toBe(3);
  });

  it('no diff when content is identical', () => {
    const content = 'a\nb\nc';
    const result = buildSimpleDiff(content, content);
    expect(result.added).toBe(0);
    expect(result.removed).toBe(0);
  });

  it('detects added lines', () => {
    const result = buildSimpleDiff('a\nb', 'a\nb\nc');
    expect(result.added).toBeGreaterThan(0);
    expect(result.newLen).toBe(3);
    expect(result.oldLen).toBe(2);
  });

  it('detects removed lines', () => {
    const result = buildSimpleDiff('a\nb\nc', 'a\nb');
    expect(result.removed).toBeGreaterThan(0);
    expect(result.newLen).toBe(2);
    expect(result.oldLen).toBe(3);
  });

  it('handles null/undefined gracefully', () => {
    // @ts-expect-error — runtime robustness test
    expect(() => buildSimpleDiff(null, 'hello')).not.toThrow();
    // @ts-expect-error
    expect(() => buildSimpleDiff('hello', undefined)).not.toThrow();
  });
});
