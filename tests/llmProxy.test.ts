import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LM_STUDIO_URL,
  hostFromV1Base,
  llmAuthHeaders,
  normalizeV1Base,
} from '../src/llmProxy';

describe('llmProxy helpers', () => {
  it('normalizeV1Base trims trailing slashes', () => {
    expect(normalizeV1Base('http://127.0.0.1:1234/v1/')).toBe('http://127.0.0.1:1234/v1');
    expect(normalizeV1Base('')).toBe(DEFAULT_LM_STUDIO_URL);
    expect(normalizeV1Base('  ')).toBe(DEFAULT_LM_STUDIO_URL);
  });

  it('llmAuthHeaders adds Bearer only when key present', () => {
    expect(llmAuthHeaders()).toEqual({ 'Content-Type': 'application/json' });
    expect(llmAuthHeaders('  sk-test  ')).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer sk-test',
    });
  });

  it('hostFromV1Base extracts origin', () => {
    expect(hostFromV1Base('http://127.0.0.1:11434/v1')).toBe('http://127.0.0.1:11434');
    expect(hostFromV1Base('not a url!!!')).toBeNull();
  });
});
