// ============================================================================
// VEBOSSO EMS — Version Check & Optional Update
// ============================================================================

import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Linking } from 'react-native';
import { supabase } from './supabase';

interface VersionCheckResult {
  needsUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
}

/**
 * Get the current app version from app.json
 */
export function getCurrentVersion(): string {
  // Get version from Constants which reads from app.json
  return Constants.expoConfig?.version || Application.nativeApplicationVersion || '1.0.0';
}

/**
 * Compare two semantic versions (e.g., "1.0.0")
 * Returns:
 *   1 if v1 > v2
 *   0 if v1 === v2
 *  -1 if v1 < v2
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;

    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }

  return 0;
}

/**
 * Check if the current app version is below the latest version
 * Fetches latest_app_version and apk_download_url from app_settings table
 */
export async function checkAppVersion(): Promise<VersionCheckResult> {
  try {
    const currentVersion = getCurrentVersion();

    // Fetch version requirements from database with timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Version check timeout')), 5000)
    );
    
    const queryPromise = supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['latest_version', 'download_url']);

    const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;

    if (error) {
      if (__DEV__) console.error('Version check error:', error);
      // If we can't check, allow app to continue (graceful degradation)
      return {
        needsUpdate: false,
        currentVersion,
        latestVersion: currentVersion,
      };
    }

    const settings: Record<string, string> = {};
    data?.forEach((item: { key: string; value: string }) => {
      settings[item.key] = item.value;
    });

    const latestVersion = settings['latest_version'] || '1.0.0';

    // Check if current version is below latest (optional update)
    const isBelowLatest = compareVersions(currentVersion, latestVersion) < 0;

    return {
      needsUpdate: isBelowLatest,
      currentVersion,
      latestVersion,
    };
  } catch (error) {
    if (__DEV__) console.error('Version check failed:', error);
    // Graceful degradation
    const currentVersion = getCurrentVersion();
    return {
      needsUpdate: false,
      currentVersion,
      latestVersion: currentVersion,
    };
  }
}

/**
 * Open GitHub to download the latest APK
 * Downloads APK directly from GitHub releases or configured URL
 */
export async function openAppStore(): Promise<void> {
  try {
    // Get download URL from database settings
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'download_url')
      .single();

    const downloadUrl = data?.value || '';
    
    if (downloadUrl) {
      const canOpen = await Linking.canOpenURL(downloadUrl);
      if (canOpen) {
        await Linking.openURL(downloadUrl);
      } else {
        if (__DEV__) console.error('Cannot open download URL');
      }
    } else {
      if (__DEV__) console.error('No APK download URL configured');
    }
  } catch (error) {
    if (__DEV__) console.error('Error opening download URL:', error);
  }
}
