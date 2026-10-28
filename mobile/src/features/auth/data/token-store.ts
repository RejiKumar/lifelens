import * as SecureStore from 'expo-secure-store';

export const ACCESS_TOKEN_KEY = 'lifelens_access_token';
export const REFRESH_TOKEN_KEY = 'lifelens_refresh_token';
export const SESSION_KEY = 'lifelens_supabase_session';

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function setTokens(accessToken: string, refreshToken: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
}

export async function setSessionJson(value: string): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, value);
}

export async function getSessionJson(): Promise<string | null> {
  return SecureStore.getItemAsync(SESSION_KEY);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

export async function getRawItem(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

export async function setRawItem(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

export async function removeRawItem(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}