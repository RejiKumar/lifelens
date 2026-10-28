import { supabaseClient } from './supabase-client';
import * as tokenStore from './token-store';

export type SessionExpiryListener = () => void;

const expiryListeners = new Set<SessionExpiryListener>();

export function subscribeToSessionExpiry(listener: SessionExpiryListener): () => void {
  expiryListeners.add(listener);
  return () => {
    expiryListeners.delete(listener);
  };
}

function emitSessionExpired(): void {
  for (const listener of [...expiryListeners]) {
    listener();
  }
}

export async function getAccessToken(): Promise<string | null> {
  return tokenStore.getAccessToken();
}

export async function getBearerHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function refreshAccessToken(): Promise<string | null> {
  const { data, error } = await supabaseClient().auth.refreshSession();
  if (error || !data.session) return null;
  return data.session.access_token;
}

export async function clearSession(): Promise<void> {
  await tokenStore.clearTokens();
}

export async function refreshAccessTokenOrExpire(): Promise<string | null> {
  const next = await refreshAccessToken();
  if (!next) {
    await tokenStore.clearTokens();
    emitSessionExpired();
  }
  return next;
}