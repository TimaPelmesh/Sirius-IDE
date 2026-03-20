import * as path from 'path';

const allowedRoots = new Set<string>();

export function addAllowedRoot(root: string): void {
  if (!root || typeof root !== 'string') return;
  const normalized = path.resolve(root);
  if (normalized) allowedRoots.add(normalized);
}

export function isPathAllowed(filePath: string): boolean {
  if (!filePath || typeof filePath !== 'string') return false;
  if (allowedRoots.size === 0) return false;
  const resolved = path.resolve(filePath);
  for (const root of allowedRoots) {
    const relative = path.relative(root, resolved);
    if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) return true;
  }
  return false;
}

export function validatePath(filePath: string): void {
  if (!isPathAllowed(filePath)) {
    throw new Error(`Доступ запрещён: путь вне открытого проекта (${filePath})`);
  }
}
