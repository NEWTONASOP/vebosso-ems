// ============================================================================
// VEBOSSO EMS — Version Check & In-App APK Update
// ============================================================================

import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking, Platform } from 'react-native';
import { supabase } from './supabase';

interface VersionCheckResult {
  needsUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  downloadUrl?: string;
}

export type DownloadProgressCallback = (progress: number) => void;

/**
 * Get the current app version from app.json
 */
export function getCurrentVersion(): string {
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

async function fetchVersionSettings(): Promise<Record<string, string>> {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Version check timeout')), 5000)
  );

  const queryPromise = supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['latest_version', 'download_url']);

  const { data, error } = (await Promise.race([queryPromise, timeoutPromise])) as any;

  if (error) {
    throw error;
  }

  const settings: Record<string, string> = {};
  data?.forEach((item: { key: string; value: string }) => {
    settings[item.key] = item.value;
  });

  return settings;
}

/**
 * Check if the current app version is below the latest version
 * Fetches latest_version and download_url from app_settings table
 */
export async function checkAppVersion(): Promise<VersionCheckResult> {
  try {
    const currentVersion = getCurrentVersion();
    const settings = await fetchVersionSettings();
    const latestVersion = settings.latest_version || '1.0.0';
    const isBelowLatest = compareVersions(currentVersion, latestVersion) < 0;

    return {
      needsUpdate: isBelowLatest,
      currentVersion,
      latestVersion,
      downloadUrl: settings.download_url,
    };
  } catch (error) {
    if (__DEV__) console.error('Version check failed:', error);
    const currentVersion = getCurrentVersion();
    return {
      needsUpdate: false,
      currentVersion,
      latestVersion: currentVersion,
    };
  }
}

/**
 * Fetch the APK download URL from Supabase app_settings
 */
export async function getDownloadUrl(): Promise<string> {
  const settings = await fetchVersionSettings();
  const downloadUrl = settings.download_url;

  if (!downloadUrl) {
    throw new Error('No APK download URL configured');
  }

  return downloadUrl;
}

/**
 * Open Android settings so the user can allow installs from this app
 */
export async function openInstallPermissionSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;

  const packageName = Application.applicationId;
  if (!packageName) {
    throw new Error('Unable to determine app package name');
  }

  await IntentLauncher.startActivityAsync('android.settings.MANAGE_UNKNOWN_APP_SOURCES', {
    data: `package:${packageName}`,
  });
}

/**
 * Download the latest APK and launch the system installer
 */
export async function downloadAndInstallApk(
  onProgress?: DownloadProgressCallback,
  version?: string
): Promise<void> {
  if (Platform.OS !== 'android') {
    throw new Error('In-app APK updates are only supported on Android');
  }

  const downloadUrl = await getDownloadUrl();
  const latestVersion = version || (await checkAppVersion()).latestVersion;
  const fileName = `vebosso-ems-v${latestVersion}.apk`;
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

  const existingFile = await FileSystem.getInfoAsync(fileUri);
  if (existingFile.exists) {
    await FileSystem.deleteAsync(fileUri, { idempotent: true });
  }

  onProgress?.(0);

  const downloadTask = FileSystem.createDownloadResumable(
    downloadUrl,
    fileUri,
    {},
    (progressData) => {
      if (progressData.totalBytesExpectedToWrite > 0) {
        onProgress?.(
          progressData.totalBytesWritten / progressData.totalBytesExpectedToWrite
        );
      }
    }
  );

  const result = await downloadTask.downloadAsync();
  if (!result?.uri) {
    throw new Error('Download failed. Please check your connection and try again.');
  }

  onProgress?.(1);

  const contentUri = await FileSystem.getContentUriAsync(result.uri);

  try {
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: 1,
      type: 'application/vnd.android.package-archive',
    });
  } catch (error) {
    if (__DEV__) console.error('APK install intent failed:', error);
    throw new Error(
      'Could not open the installer. Allow "Install unknown apps" for VEBOSSO EMS in Settings, then try again.'
    );
  }
}

/**
 * Fallback: open the download URL in the browser (GitHub releases)
 */
export async function openAppStore(): Promise<void> {
  try {
    const downloadUrl = await getDownloadUrl();
    const canOpen = await Linking.canOpenURL(downloadUrl);

    if (canOpen) {
      await Linking.openURL(downloadUrl);
    } else {
      throw new Error('Cannot open download URL');
    }
  } catch (error) {
    if (__DEV__) console.error('Error opening download URL:', error);
    throw error;
  }
}
