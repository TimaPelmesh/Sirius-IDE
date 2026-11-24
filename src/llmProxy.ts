import { BrowserWindow, ipcMain } from 'electron';

export const DEFAULT_LM_STUDIO_URL = 'http://127.0.0.1:1234/v1';
export const ABORT_MESSAGE = 'Запрос остановлен';

export type LLMModelsRequest = {
  baseUrl?: string;
  apiKey?: string;
  providerId?: string;
};

export type LLMStreamOptions = {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  seed?: number;
  response_format?: unknown;
};

let llmAbortController: AbortController | null = null;

export function normalizeV1Base(url: string | undefined, fallback = DEFAULT_LM_STUDIO_URL): string {
  const t = (url || '').trim();
  if (!t) return fallback;
  return t.replace(/\/+$/, '');
}

export function llmAuthHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const key = (apiKey || '').trim();
  if (key) headers.Authorization = `Bearer ${key}`;
  return headers;
}

export function hostFromV1Base(baseUrl: string): string | null {
  try {
    const u = new URL(baseUrl.includes('://') ? baseUrl : `http://${baseUrl}`);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

async function fetchOpenAiCompatibleModels(baseUrl: string, apiKey?: string) {
  const r = await fetch(`${normalizeV1Base(baseUrl)}/models`, { headers: llmAuthHeaders(apiKey) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function fetchOllamaTagsMapped(baseUrl: string) {
  const host = hostFromV1Base(normalizeV1Base(baseUrl));
  if (!host) return null;
  const r = await fetch(`${host}/api/tags`);
  if (!r.ok) return null;
  const j = (await r.json()) as { models?: Array<{ name?: string; model?: string }> };
  const list = (j.models || [])
    .map((m) => ({ id: (m.name || m.model || '').trim() }))
    .filter((x) => x.id);
  return { data: list, object: 'list' };
}

export async function resolveLLMModels(req: LLMModelsRequest) {
  const baseUrl = normalizeV1Base(req.baseUrl);
  const providerId = (req.providerId || '').trim();
  try {
    return await fetchOpenAiCompatibleModels(baseUrl, req.apiKey);
  } catch (_) {
    if (providerId === 'ollama' || baseUrl.includes(':11434')) {
      return await fetchOllamaTagsMapped(baseUrl);
    }
    return null;
  }
}

export function abortLlmStream() {
  if (llmAbortController) {
    llmAbortController.abort();
    llmAbortController = null;
  }
}

export async function proxyLlmChatStream(
  win: BrowserWindow,
  messages: unknown[],
  opts: LLMStreamOptions,
  channels: { chunk: string; end: string; error: string },
) {
  const baseUrl = normalizeV1Base(opts.baseUrl);
  const temperature = typeof opts.temperature === 'number' ? opts.temperature : 0.2;
  const max_tokens = typeof opts.max_tokens === 'number' ? opts.max_tokens : 16384;
  const body: Record<string, unknown> = {
    model: typeof opts.model === 'string' ? opts.model : '',
    messages,
    stream: true,
    temperature,
    max_tokens,
  };
  if (typeof opts.top_p === 'number') body.top_p = opts.top_p;
  if (typeof opts.seed === 'number') body.seed = opts.seed;
  if (opts.response_format && typeof opts.response_format === 'object') body.response_format = opts.response_format;

  llmAbortController = new AbortController();
  const signal = llmAbortController.signal;
  try {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      signal,
      method: 'POST',
      headers: llmAuthHeaders(opts.apiKey),
      body: JSON.stringify(body),
    });
    llmAbortController = null;
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    if (!resp.body) throw new Error('No response body');
    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
        try {
          const j = JSON.parse(line.slice(6)) as { choices?: Array<{ delta?: { content?: string } }> };
          const delta = j.choices?.[0]?.delta?.content;
          if (delta) win.webContents.send(channels.chunk, delta);
        } catch (_) {}
      }
    }
    win.webContents.send(channels.end);
  } catch (e) {
    llmAbortController = null;
    const err = e as Error;
    const msg = err.name === 'AbortError' ? ABORT_MESSAGE : (err?.message ?? String(e));
    win.webContents.send(channels.error, msg);
  }
}

/** Register LLM-related IPC once (call from main after app ready / at module load). */
export function registerLlmIpc(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle('llm-models', async (_: unknown, req: LLMModelsRequest) => {
    try {
      return await resolveLLMModels(req || {});
    } catch (_) {
      return null;
    }
  });

  ipcMain.on('llm-abort', () => abortLlmStream());

  ipcMain.handle('llm-stream', async (_: unknown, payload: unknown) => {
    const win = getMainWindow();
    if (!win?.webContents) return;
    const messages = Array.isArray(payload)
      ? payload
      : (payload as { messages?: unknown[] })?.messages;
    if (!messages || !Array.isArray(messages)) return;
    const opts =
      typeof payload === 'object' && payload !== null && !Array.isArray(payload)
        ? (payload as LLMStreamOptions & { messages?: unknown[] })
        : {};
    await proxyLlmChatStream(win, messages, opts, {
      chunk: 'llm-chunk',
      end: 'llm-stream-end',
      error: 'llm-stream-error',
    });
  });

  // Legacy LM Studio IPC
  ipcMain.handle('lmstudio-models', async () =>
    resolveLLMModels({ baseUrl: DEFAULT_LM_STUDIO_URL, providerId: 'lmstudio' }),
  );
  ipcMain.on('lmstudio-abort', () => abortLlmStream());
  ipcMain.handle('lmstudio-stream', async (_: unknown, payload: unknown) => {
    const win = getMainWindow();
    if (!win?.webContents) return;
    const messages = Array.isArray(payload)
      ? payload
      : (payload as { messages?: unknown[] })?.messages;
    if (!messages || !Array.isArray(messages)) return;
    const raw =
      typeof payload === 'object' && payload !== null && !Array.isArray(payload)
        ? (payload as LLMStreamOptions & { messages?: unknown[] })
        : {};
    const opts: LLMStreamOptions = {
      baseUrl: DEFAULT_LM_STUDIO_URL,
      apiKey: raw.apiKey,
      model: raw.model,
      temperature: raw.temperature,
      max_tokens: raw.max_tokens,
      response_format: raw.response_format,
    };
    await proxyLlmChatStream(win, messages, opts, {
      chunk: 'lmstudio-chunk',
      end: 'lmstudio-stream-end',
      error: 'lmstudio-stream-error',
    });
  });
}
