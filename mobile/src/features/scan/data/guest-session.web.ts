import * as Crypto from 'expo-crypto';

const SESSION_KEY = 'lifelens.guest.session.v1';

export async function getOrCreateGuestSessionId(): Promise<string> {
  if (typeof localStorage === 'undefined') return Crypto.randomUUID();
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const fresh = Crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, fresh);
  return fresh;
}