import * as SecureStore from 'expo-secure-store';
import type { FlashMode } from 'expo-camera';

const FLASH_KEY = 'lifelens.camera.flash.v1';

export async function loadFlashPreference(): Promise<FlashMode> {
  try {
    const value = await SecureStore.getItemAsync(FLASH_KEY);
    if (value === 'on' || value === 'off' || value === 'auto' || value === 'screen') {
      return value;
    }
  } catch {
    // ignore read errors, fall back to off
  }
  return 'off';
}

export async function saveFlashPreference(flash: FlashMode): Promise<void> {
  try {
    await SecureStore.setItemAsync(FLASH_KEY, flash);
  } catch {
    // best-effort persistence; ignore
  }
}