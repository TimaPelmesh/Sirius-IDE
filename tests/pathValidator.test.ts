import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'path';
import { addAllowedRoot, isPathAllowed, validatePath, __resetAllowedRootsForTests } from '../src/pathValidator';

describe('pathValidator', () => {
  beforeEach(() => {
    __resetAllowedRootsForTests();
  });

  it('denies access when no roots are configured', () => {
    const probe = path.resolve('C:/tmp/example.txt');
    expect(isPathAllowed(probe)).toBe(false);
    expect(() => validatePath(probe)).toThrowError(/Доступ запрещён/);
  });

  it('allows paths inside configured root', () => {
    const root = path.resolve('C:/workspace/project');
    const insideFile = path.join(root, 'src', 'index.ts');
    addAllowedRoot(root);
    expect(isPathAllowed(insideFile)).toBe(true);
    expect(() => validatePath(insideFile)).not.toThrow();
  });

  it('denies paths outside configured root', () => {
    const root = path.resolve('C:/workspace/project');
    const outsideFile = path.resolve('C:/workspace/other/secret.txt');
    addAllowedRoot(root);
    expect(isPathAllowed(outsideFile)).toBe(false);
    expect(() => validatePath(outsideFile)).toThrowError(/Доступ запрещён/);
  });
});
