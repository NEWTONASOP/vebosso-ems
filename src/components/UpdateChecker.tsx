// ============================================================================
// VEBOSSO EMS — In-App Update Checker
// ============================================================================

import * as Application from 'expo-application';
import { useEffect, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { supabase } from '../lib/supabase';

export function UpdateChecker() {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android' || checked) return;
    
    checkForUpdates();
    setChecked(true);
  }, [checked]);

  const checkForUpdates = async () => {
    try {
      // Get current app version
      const currentVersion = Application.nativeApplicationVersion || '1.0.0';

      // Fetch latest version from Supabase
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['latest_version', 'download_url']);

      if (error || !data) return;

      const latestVersion = data.find((s) => s.key === 'latest_version')?.value;
      const downloadUrl = data.find((s) => s.key === 'download_url')?.value;

      if (!latestVersion || !downloadUrl) return;

      // Compare versions
      if (isNewerVersion(currentVersion, latestVersion)) {
        showUpdateAlert(latestVersion, downloadUrl);
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
    }
  };

  const isNewerVersion = (current: string, latest: string): boolean => {
    const currentParts = current.split('.').map(Number);
    const latestParts = latest.split('.').map(Number);

    for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
      const currentPart = currentParts[i] || 0;
      const latestPart = latestParts[i] || 0;

      if (latestPart > currentPart) return true;
      if (latestPart < currentPart) return false;
    }

    return false;
  };

  const showUpdateAlert = (version: string, url: string) => {
    Alert.alert(
      '🎉 Update Available',
      `Version ${version} is now available! Download and install the latest version to get new features and improvements.`,
      [
        {
          text: 'Later',
          style: 'cancel',
        },
        {
          text: 'Download',
          onPress: () => {
            Linking.openURL(url).catch((err) =>
              console.error('Failed to open download URL:', err)
            );
          },
        },
      ]
    );
  };

  return null; // This component doesn't render anything
}
