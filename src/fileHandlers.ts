import * as fs from 'fs-extra';
import * as path from 'path';
import type { Dirent } from 'fs';
import { validatePath } from './pathValidator';

const MAX_TEXT_FILE_BYTES = 8 * 1024 * 1024; // 8 MB safety cap for renderer text operations

function assertSafePathInput(filePath: unknown): asserts filePath is string {
  if (typeof filePath !== 'string' || filePath.trim() === '') {
    throw new Error('Некорректный путь файла');
  }
  if (filePath.includes('\u0000')) {
    throw new Error('Некорректный путь файла: содержит запрещённый символ');
  }
}

function assertSafeTextPayload(content: unknown): asserts content is string {
  if (typeof content !== 'string') {
    throw new Error('Некорректное содержимое файла');
  }
  if (Buffer.byteLength(content, 'utf8') > MAX_TEXT_FILE_BYTES) {
    throw new Error(`Файл слишком большой для текстовой операции (>${MAX_TEXT_FILE_BYTES} байт)`);
  }
}

async function assertReadableTextSize(filePath: string): Promise<void> {
  const stat = await fs.stat(filePath);
  if (stat.size > MAX_TEXT_FILE_BYTES) {
    throw new Error(`Файл слишком большой для текстового чтения (>${MAX_TEXT_FILE_BYTES} байт)`);
  }
}

async function safeWrite(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);

  // Create directory tree; throw a clear error if we can't
  try {
    await fs.ensureDir(dir);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    throw new Error(
      `Не удалось создать директорию "${dir}": ${e.code} — проверьте права доступа к диску.`
    );
  }

  // Check write permission on the directory
  try {
    await fs.access(dir, fs.constants.W_OK);
  } catch (_) {
    throw new Error(
      `Нет прав на запись в директорию: "${dir}". Запустите IDE от имени администратора или измените права папки.`
    );
  }

  // Try writing; on EPERM try atomic write (write to .tmp then rename)
  try {
    await fs.writeFile(filePath, content, 'utf-8');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'EPERM' || e.code === 'EACCES') {
      // Atomic write workaround for locked files on external drives
      const tmp = filePath + '.siriustmp';
      try {
        await fs.writeFile(tmp, content, 'utf-8');
        await fs.rename(tmp, filePath);
      } catch (err2) {
        try { await fs.remove(tmp); } catch (_) {}
        throw new Error(
          `EPERM: нет прав записи в файл "${filePath}". Проверьте права и тип файловой системы (FAT32 не поддерживает некоторые операции).`
        );
      }
    } else {
      throw err;
    }
  }
}

export const fileHandlers = {
  'read-file': async (_: unknown, filePath: string) => {
    assertSafePathInput(filePath);
    validatePath(filePath);
    await assertReadableTextSize(filePath);
    return fs.readFile(filePath, 'utf-8');
  },

  'read-file-safe': async (_: unknown, filePath: string): Promise<{ content: string; error: string | null }> => {
    assertSafePathInput(filePath);
    validatePath(filePath);
    try {
      await assertReadableTextSize(filePath);
      const content = await fs.readFile(filePath, 'utf-8');
      return { content: typeof content === 'string' ? content : String(content), error: null };
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      return { content: '', error: err?.message || String(e) };
    }
  },

  'write-file': async (_: unknown, filePath: string, content: string) => {
    assertSafePathInput(filePath);
    assertSafeTextPayload(content);
    validatePath(filePath);
    await safeWrite(filePath, content);
  },

  'read-dir': async (_: unknown, dirPath: string) => {
    assertSafePathInput(dirPath);
    validatePath(dirPath);
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.map((e: Dirent) => ({
      name: e.name,
      isDirectory: e.isDirectory(),
      path: path.join(dirPath, e.name),
    }));
  },

  'exists': async (_: unknown, filePath: string) => {
    assertSafePathInput(filePath);
    validatePath(filePath);
    return fs.pathExists(filePath);
  },

  'mkdir': async (_: unknown, dirPath: string) => {
    assertSafePathInput(dirPath);
    validatePath(dirPath);
    return fs.ensureDir(dirPath);
  },

  'stat': async (_: unknown, filePath: string) => {
    assertSafePathInput(filePath);
    validatePath(filePath);
    const s = await fs.stat(filePath);
    // stat result is not serializable as-is; return plain object
    return {
      size: s.size,
      isDirectory: s.isDirectory(),
      isFile: s.isFile(),
      mtime: s.mtime.toISOString(),
      ctime: s.ctime.toISOString(),
    };
  },

  'rename': async (_: unknown, oldPath: string, newPath: string) => {
    assertSafePathInput(oldPath);
    assertSafePathInput(newPath);
    validatePath(oldPath);
    validatePath(newPath);
    return fs.move(oldPath, newPath, { overwrite: false });
  },

  'delete': async (_: unknown, filePath: string) => {
    assertSafePathInput(filePath);
    validatePath(filePath);
    return fs.remove(filePath);
  },

  'copy-path': async (_: unknown, srcPath: string, destPath: string) => {
    assertSafePathInput(srcPath);
    assertSafePathInput(destPath);
    validatePath(srcPath);
    validatePath(destPath);
    await fs.copy(srcPath, destPath, { overwrite: false, errorOnExist: true });
  },

  // ── Persistent state backup (survives localStorage wipe) ─────
  'save-project-state': async (_: unknown, data: string) => {
    const stateDir = path.join(
      process.env.APPDATA || process.env.HOME || process.cwd(),
      'sirius-ide'
    );
    await fs.ensureDir(stateDir);
    await fs.writeFile(path.join(stateDir, 'state.json'), data, 'utf-8');
  },

  'load-project-state': async () => {
    const statePath = path.join(
      process.env.APPDATA || process.env.HOME || process.cwd(),
      'sirius-ide',
      'state.json'
    );
    if (await fs.pathExists(statePath)) {
      return fs.readFile(statePath, 'utf-8');
    }
    return null;
  },
};
