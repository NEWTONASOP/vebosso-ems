// ============================================================================
// VEBOSSO EMS — Over-the-Air (OTA) JS Bundle Updates (Expo Updates)
// ============================================================================
// Used by GitHub Actions–built APKs to receive JS/UI updates without reinstall.
// Failures are non-fatal — the app continues on the embedded bundle.
// ============================================================================

import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';

/**
 * Checks Expo's update server for a newer JS bundle, downloads it, and reloads.
 * Returns true if a reload was triggered (callers usually won't run after reload).
 */
export async function applyOtaUpdateIfAvailable(): Promise<boolean> {
  if (__DEV__ || isRunningInExpoGo() || Platform.OS === 'web') {
    return false;
  }

  try {
    const Updates = await import('expo-updates');

    if (!Updates.isEnabled) {
      return false;
    }

    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) {
      return false;
    }

    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
    return true;
  } catch (error) {
    if (__DEV__) console.warn('OTA update check failed (using embedded bundle):', error);
    return false;
  }
}
