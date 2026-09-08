import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'lifelens.guest.session.v1';

export async function getOrCreateGuestSessionId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(SESSION_KEY);
  if (existing) return existing;
  const fresh = Crypto.randomUUID();
  await SecureStore.setItemAsync(SESSION_KEY, fresh);
  return fresh;
}