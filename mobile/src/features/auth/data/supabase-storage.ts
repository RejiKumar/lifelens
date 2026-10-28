import type { SupportedStorage } from '@supabase/supabase-js';

import * as tokenStore from './token-store';

const RAW_PREFIX = 'lifelens_supabase_';

function isSessionKey(key: string): boolean {
  return key.endsWith('-auth-token');
}

function decodeBase64Url(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (const c of padded) {
    if (c === '=') break;
    const idx = chars.indexOf(c);
    if (idx === -1) continue;
    buffer = (buffer << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return out;
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const segment = token.split('.')[1];
  if (!segment) return null;
  try {
    return JSON.parse(decodeBase64Url(segment)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function readStoredSessionJson(): Promise<string | null> {
  const stored = await tokenStore.getSessionJson();
  if (stored) return stored;
  const accessToken = await tokenStore.getAccessToken();
  const refreshToken = await tokenStore.getRefreshToken();
  if (!accessToken || !refreshToken) return null;
  const payload = decodeJwtPayload(accessToken);
  if (!payload) return null;
  const expiresAt = typeof payload.exp === 'number' ? payload.exp : null;
  return JSON.stringify({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'bearer',
    expires_in: null,
    expires_at: expiresAt,
    user: null,
  });
}

export const supabaseStorage: SupportedStorage = {
  async getItem(key: string): Promise<string | null> {
    if (isSessionKey(key)) {
      return readStoredSessionJson();
    }
    return tokenStore.getRawItem(`${RAW_PREFIX}${key}`);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (isSessionKey(key)) {
      await tokenStore.setSessionJson(value);
      try {
        const parsed = JSON.parse(value) as {
          access_token?: string;
          refresh_token?: string;
        };
        if (parsed.access_token && parsed.refresh_token) {
          await tokenStore.setTokens(parsed.access_token, parsed.refresh_token);
        }
      } catch {
        // Non-session payloads (e.g. code verifier) never pass through here.
      }
      return;
    }
    await tokenStore.setRawItem(`${RAW_PREFIX}${key}`, value);
  },
  async removeItem(key: string): Promise<void> {
    if (isSessionKey(key)) {
      await tokenStore.clearTokens();
      return;
    }
    await tokenStore.removeRawItem(`${RAW_PREFIX}${key}`);
  },
};