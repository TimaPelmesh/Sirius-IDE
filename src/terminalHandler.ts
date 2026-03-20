const shells: Map<string, { pty: { write: (d: string) => void; resize: (c: number, r: number) => void; kill: () => void } }> = new Map();

let ptyModule: typeof import('node-pty') | null = null;
try {
  ptyModule = require('node-pty');
} catch {
  ptyModule = null;
}

export function createTerminal(cwd: string, id: string, onData: (data: string) => void): boolean {
  if (!ptyModule) return false;
  try {
    const shell = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : (process.env.SHELL || 'bash');
    const proc = ptyModule.spawn(shell, [], {
      cwd: cwd || process.env.HOME || process.env.USERPROFILE || '/',
      env: process.env as Record<string, string>,
      cols: 80,
      rows: 24,
    });
    proc.onData((data: string) => onData(data));
    proc.onExit(() => {
      shells.delete(id);
    });
    shells.set(id, { pty: proc });
    return true;
  } catch {
    return false;
  }
}

export function writeToTerminal(id: string, data: string): void {
  const t = shells.get(id);
  if (t) t.pty.write(data);
}

export function resizeTerminal(id: string, cols: number, rows: number): void {
  const t = shells.get(id);
  if (t) t.pty.resize(cols, rows);
}

export function killTerminal(id: string): void {
  const t = shells.get(id);
  if (t) {
    t.pty.kill();
    shells.delete(id);
  }
}
