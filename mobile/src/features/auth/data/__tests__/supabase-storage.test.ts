import * as SecureStore from 'expo-secure-store';

import { supabaseStorage, decodeJwtPayload } from '../supabase-storage';
import * as tokenStore from '../token-store';

jest.mock('expo-secure-store', () => {
  const map = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => map.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      map.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      map.delete(key);
    }),
    __map: map,
  };
});

function sessionJson(access: string, refresh: string, exp: number): string {
  return JSON.stringify({
    access_token: access,
    refresh_token: refresh,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: exp,
    user: { id: 'u1', email: 'a@b.com', is_anonymous: false },
  });
}

const accessToken =
  'eyJhbGciOiJSUzI1NiIsImtpZCI6ImtpZCJ9.eyJzdWIiOiJ1MSIsImlhdCI6MTAwMCwiZXhwIjoxMDk5fQ.signature';

describe('supabaseStorage', () => {
  beforeEach(async () => {
    (SecureStore as unknown as { __map: Map<string, string> }).__map.clear();
    jest.clearAllMocks();
  });

  it('stores session JSON and mirrors access/refresh tokens', async () => {
    const session = sessionJson('tok-a', 'tok-r', 1099);
    await supabaseStorage.setItem('lifelens_session-auth-token', session);

    expect(await tokenStore.getSessionJson()).toBe(session);
    expect(await tokenStore.getAccessToken()).toBe('tok-a');
    expect(await tokenStore.getRefreshToken()).toBe('tok-r');
  });

  it('reads session JSON back for the auth-token key', async () => {
    const session = sessionJson('tok-a', 'tok-r', 1099);
    await supabaseStorage.setItem('lifelens_session-auth-token', session);

    expect(await supabaseStorage.getItem('lifelens_session-auth-token')).toBe(session);
  });

  it('reconstructs a session from mirrored tokens when JSON is missing', async () => {
    await tokenStore.setTokens(accessToken, 'tok-r');

    const raw = await supabaseStorage.getItem('lifelens_session-auth-token');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(parsed.access_token).toBe(accessToken);
    expect(parsed.refresh_token).toBe('tok-r');
    expect(parsed.expires_at).toBe(1099);
  });

  it('removes session data when removing the auth-token key', async () => {
    const session = sessionJson('tok-a', 'tok-r', 1099);
    await supabaseStorage.setItem('lifelens_session-auth-token', session);
    await supabaseStorage.removeItem('lifelens_session-auth-token');

    expect(await tokenStore.getAccessToken()).toBeNull();
    expect(await tokenStore.getRefreshToken()).toBeNull();
    expect(await tokenStore.getSessionJson()).toBeNull();
  });

  it('round-trips non-session keys under a prefix', async () => {
    await supabaseStorage.setItem('sb-code-verifier', 'verifier-value');
    expect(await tokenStore.getRawItem('lifelens_supabase_sb-code-verifier')).toBe(
      'verifier-value',
    );
    expect(await supabaseStorage.getItem('sb-code-verifier')).toBe('verifier-value');

    await supabaseStorage.removeItem('sb-code-verifier');
    expect(await supabaseStorage.getItem('sb-code-verifier')).toBeNull();
  });

  it('decodes the JWT payload from a compact token', () => {
    const payload = decodeJwtPayload(accessToken);
    expect(payload).toMatchObject({ sub: 'u1', iat: 1000, exp: 1099 });
  });

  it('returns null for malformed tokens', () => {
    expect(decodeJwtPayload('not-a-token')).toBeNull();
    expect(decodeJwtPayload('')).toBeNull();
  });
});