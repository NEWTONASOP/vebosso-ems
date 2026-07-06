// ============================================================================
// VEBOSSO EMS — In-App Update Checker (Optional Updates)
// ============================================================================

import { useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { checkAppVersion, openAppStore } from '../lib/versionCheck';
import { useAuthStore } from '../store/authStore';

export function UpdateChecker() {
  const [checked, setChecked] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    // Only run on Android, only once, and only after the user is authenticated
    // (ensures Supabase RLS is satisfied and the query won't fail silently)
    if (Platform.OS !== 'android' || checked || !isAuthenticated) return;

    setChecked(true);
    checkForOptionalUpdate();
  }, [isAuthenticated, checked]);

  const checkForOptionalUpdate = async () => {
    try {
      const result = await checkAppVersion();

      if (result.needsUpdate) {
        showUpdateAlert(result.latestVersion);
      }
    } catch (error) {
      if (__DEV__) console.error('Error checking for updates:', error);
    }
  };

  const showUpdateAlert = (version: string) => {
    Alert.alert(
      'Update Available',
      `Version ${version} is now available! Download and install the latest version to get new features and improvements.`,
      [
        {
          text: 'Later',
          style: 'cancel',
        },
        {
          text: 'Download Now',
          onPress: () => {
            openAppStore().catch((err) => {
              if (__DEV__) console.error('Failed to open download URL:', err);
            });
          },
        },
      ]
    );
  };

  return null;
}
