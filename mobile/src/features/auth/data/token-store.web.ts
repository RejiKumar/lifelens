export const ACCESS_TOKEN_KEY = 'lifelens_access_token';
export const REFRESH_TOKEN_KEY = 'lifelens_refresh_token';
export const SESSION_KEY = 'lifelens_supabase_session';

function read(key: string): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(key);
}

function write(key: string, value: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(key, value);
}

function remove(key: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(key);
}

export async function getAccessToken(): Promise<string | null> {
  return read(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return read(REFRESH_TOKEN_KEY);
}

export async function setTokens(accessToken: string, refreshToken: string): Promise<void> {
  write(ACCESS_TOKEN_KEY, accessToken);
  write(REFRESH_TOKEN_KEY, refreshToken);
}

export async function setSessionJson(value: string): Promise<void> {
  write(SESSION_KEY, value);
}

export async function getSessionJson(): Promise<string | null> {
  return read(SESSION_KEY);
}

export async function clearTokens(): Promise<void> {
  remove(ACCESS_TOKEN_KEY);
  remove(REFRESH_TOKEN_KEY);
  remove(SESSION_KEY);
}

export async function getRawItem(key: string): Promise<string | null> {
  return read(key);
}

export async function setRawItem(key: string, value: string): Promise<void> {
  write(key, value);
}

export async function removeRawItem(key: string): Promise<void> {
  remove(key);
}