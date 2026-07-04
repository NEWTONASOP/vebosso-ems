// ============================================================================
// VEBOSSO EMS — In-App Update Checker (Optional Updates)
// ============================================================================

import { useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { checkAppVersion, openAppStore } from '../lib/versionCheck';

export function UpdateChecker() {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android' || checked) return;
    
    checkForOptionalUpdate();
    setChecked(true);
  }, [checked]);

  const checkForOptionalUpdate = async () => {
    try {
      const result = await checkAppVersion();

      // Show dialog if update is available
      if (result.needsUpdate) {
        showUpdateAlert(result.latestVersion);
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
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
            openAppStore().catch((err) =>
              console.error('Failed to open download URL:', err)
            );
          },
        },
      ]
    );
  };

  return null; // This component doesn't render anything
}
