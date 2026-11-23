import { app, safeStorage } from 'electron';
import * as path from 'path';
import * as fs from 'fs-extra';

type VaultFile = {
  version: 1;
  encryption: 'safeStorage' | 'plain-fallback';
  secrets: Record<string, string>;
};

function vaultPath(): string {
  return path.join(app.getPath('userData'), 'secure-secrets.json');
}

async function readVault(): Promise<VaultFile> {
  const p = vaultPath();
  try {
    if (!(await fs.pathExists(p))) {
      return { version: 1, encryption: 'safeStorage', secrets: {} };
    }
    const raw = await fs.readFile(p, 'utf-8');
    const parsed = JSON.parse(raw) as VaultFile;
    if (!parsed || typeof parsed !== 'object') {
      return { version: 1, encryption: 'safeStorage', secrets: {} };
    }
    return {
      version: 1,
      encryption: parsed.encryption === 'plain-fallback' ? 'plain-fallback' : 'safeStorage',
      secrets: parsed.secrets && typeof parsed.secrets === 'object' ? parsed.secrets : {},
    };
  } catch {
    return { version: 1, encryption: 'safeStorage', secrets: {} };
  }
}

async function writeVault(vault: VaultFile): Promise<void> {
  const p = vaultPath();
  await fs.ensureDir(path.dirname(p));
  await fs.writeFile(p, JSON.stringify(vault, null, 2), 'utf-8');
}

function encodeSecret(value: string): { blob: string; encryption: 'safeStorage' | 'plain-fallback' } {
  const text = String(value ?? '');
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const buf = safeStorage.encryptString(text);
      return { blob: buf.toString('base64'), encryption: 'safeStorage' };
    }
  } catch {
    /* fallback below */
  }
  // Last resort: stay out of the project tree; mark as non-OS-encrypted.
  return { blob: Buffer.from(text, 'utf-8').toString('base64'), encryption: 'plain-fallback' };
}

function decodeSecret(blob: string, encryption: 'safeStorage' | 'plain-fallback'): string {
  if (!blob) return '';
  try {
    const buf = Buffer.from(blob, 'base64');
    if (encryption === 'safeStorage' && safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(buf);
    }
    return buf.toString('utf-8');
  } catch {
    return '';
  }
}

export async function secureSet(key: string, value: string): Promise<{ ok: boolean; encryption: string }> {
  const k = String(key || '').trim();
  if (!k) return { ok: false, encryption: 'none' };
  const vault = await readVault();
  const encoded = encodeSecret(value);
  vault.encryption = encoded.encryption;
  if (!value) delete vault.secrets[k];
  else vault.secrets[k] = encoded.blob;
  await writeVault(vault);
  return { ok: true, encryption: encoded.encryption };
}

export async function secureGet(key: string): Promise<string> {
  const k = String(key || '').trim();
  if (!k) return '';
  const vault = await readVault();
  const blob = vault.secrets[k];
  if (!blob) return '';
  return decodeSecret(blob, vault.encryption);
}

export async function secureDelete(key: string): Promise<boolean> {
  const k = String(key || '').trim();
  if (!k) return false;
  const vault = await readVault();
  if (!(k in vault.secrets)) return false;
  delete vault.secrets[k];
  await writeVault(vault);
  return true;
}

export function secureEncryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}
