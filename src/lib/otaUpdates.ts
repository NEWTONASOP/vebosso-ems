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
 *
 * `onUpdateAvailable` fires once an update is confirmed to exist, before the
 * download starts — `fetchUpdateAsync()` is the step that can take a few
 * seconds, and a caller can use this moment to swap a frozen splash screen
 * for something that says "Updating…" instead of just looking hung.
 */
export async function applyOtaUpdateIfAvailable(
  onUpdateAvailable?: () => void
): Promise<boolean> {
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

    onUpdateAvailable?.();

    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
    return true;
  } catch (error) {
    if (__DEV__) console.warn('OTA update check failed (using embedded bundle):', error);
    return false;
  }
}
