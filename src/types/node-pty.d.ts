declare module 'node-pty' {
  export function spawn(
    file: string,
    args: string[],
    options: { cwd?: string; env?: Record<string, string>; cols?: number; rows?: number }
  ): {
    onData: (cb: (data: string) => void) => void;
    onExit: (cb: () => void) => void;
    write: (data: string) => void;
    resize: (cols: number, rows: number) => void;
    kill: () => void;
  };
}
