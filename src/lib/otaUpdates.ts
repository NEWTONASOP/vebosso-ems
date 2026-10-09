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
 *
 * The splash waits at most `waitMs` for the server to answer. On slow mobile
 * data the check alone took seconds and the app sat on the logo; past that,
 * the app opens and a found update downloads quietly for the next start.
 */
export async function applyOtaUpdateIfAvailable(
  onUpdateAvailable?: () => void,
  waitMs = 1500
): Promise<boolean> {
  if (__DEV__ || isRunningInExpoGo() || Platform.OS === 'web') {
    return false;
  }

  try {
    const Updates = await import('expo-updates');

    if (!Updates.isEnabled) {
      return false;
    }

    const check = Updates.checkForUpdateAsync();
    const result = await Promise.race([
      check,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), waitMs)),
    ]);
    if (result === null) {
      // Slow answer: don't hold the app. Fetch in the background — Expo uses
      // a downloaded update the next time the app starts.
      void check
        .then((late) => (late.isAvailable ? Updates.fetchUpdateAsync() : null))
        .catch(() => {});
      return false;
    }
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
