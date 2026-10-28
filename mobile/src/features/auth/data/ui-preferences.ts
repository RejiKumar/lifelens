import * as SecureStore from 'expo-secure-store';

const ONBOARDING_KEY = 'lifelens_onboarding_seen';
const GUEST_BANNER_KEY = 'lifelens_guest_banner_dismissed';

export async function hasSeenOnboarding(): Promise<boolean> {
  return (await SecureStore.getItemAsync(ONBOARDING_KEY)) === 'true';
}

export async function markOnboardingSeen(): Promise<void> {
  await SecureStore.setItemAsync(ONBOARDING_KEY, 'true');
}

export async function isGuestBannerDismissed(): Promise<boolean> {
  return (await SecureStore.getItemAsync(GUEST_BANNER_KEY)) === 'true';
}

export async function setGuestBannerDismissed(): Promise<void> {
  await SecureStore.setItemAsync(GUEST_BANNER_KEY, 'true');
}