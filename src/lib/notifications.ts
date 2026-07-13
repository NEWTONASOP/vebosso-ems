// ============================================================================
// VEBOSSO EMS — Push Notification Helpers
// ============================================================================

import type * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';
import { isRunningInExpoGo } from 'expo';

// Lazily load expo-notifications to prevent crash under Expo Go on Android
const expoNotifications = !isRunningInExpoGo()
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ? (require('expo-notifications') as typeof Notifications)
  : null;

let androidChannelsConfigured = false;

const SAVE_TOKEN_MAX_ATTEMPTS = 3;
const FOREGROUND_SYNC_MIN_INTERVAL_MS = 30_000;
let lastForegroundSyncAt = 0;

// Configure notification behavior if available
if (expoNotifications) {
  expoNotifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function ensureAndroidNotificationChannels(): Promise<void> {
  if (!expoNotifications || Platform.OS !== 'android' || androidChannelsConfigured) {
    return;
  }

  await expoNotifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: expoNotifications.AndroidImportance?.HIGH ?? 6,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#2563EB',
    sound: 'default',
  });

  await expoNotifications.setNotificationChannelAsync('approvals', {
    name: 'Approvals',
    description: 'Check-in and checkout approval notifications',
    importance: expoNotifications.AndroidImportance?.HIGH ?? 6,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#F59E0B',
    sound: 'default',
  });

  await expoNotifications.setNotificationChannelAsync('tasks', {
    name: 'Tasks',
    description: 'Task assignment notifications',
    importance: expoNotifications.AndroidImportance?.DEFAULT ?? 5,
    lightColor: '#2563EB',
    sound: 'default',
  });

  await expoNotifications.setNotificationChannelAsync('announcements', {
    name: 'Announcements',
    description: 'Company announcements',
    importance: expoNotifications.AndroidImportance?.DEFAULT ?? 5,
    lightColor: '#6366F1',
    sound: 'default',
  });

  androidChannelsConfigured = true;
}

/**
 * Register for push notifications and return the Expo push token
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!expoNotifications) {
    console.warn('Push notifications are not supported in Expo Go');
    return null;
  }
  let token: string | null = null;

  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device');
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await expoNotifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permissions if not already granted
  if (existingStatus !== 'granted') {
    const { status } = await expoNotifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Push notification permission not granted');
    return null;
  }

  // Get the Expo push token
  try {
    const projectId = process.env.EXPO_PUBLIC_PROJECT_ID || Constants.expoConfig?.extra?.eas?.projectId;
    const pushToken = await expoNotifications.getExpoPushTokenAsync({
      projectId,
    });
    token = pushToken.data;
  } catch (error) {
    if (__DEV__) console.error('Error getting push token:', error);
    return null;
  }

  // Configure Android notification channels (once per app session)
  await ensureAndroidNotificationChannels();

  return token;
}

/**
 * Save the push token to the user's profile (with retry).
 * Returns true when the token is persisted successfully.
 */
export async function savePushToken(userId: string, token: string): Promise<boolean> {
  for (let attempt = 1; attempt <= SAVE_TOKEN_MAX_ATTEMPTS; attempt++) {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ expo_push_token: token } as any)
        .eq('id', userId);

      if (!error) {
        return true;
      }

      console.warn(
        `Push token save failed (attempt ${attempt}/${SAVE_TOKEN_MAX_ATTEMPTS}):`,
        error.message
      );
    } catch (error) {
      console.warn(
        `Push token save error (attempt ${attempt}/${SAVE_TOKEN_MAX_ATTEMPTS}):`,
        error
      );
    }

    if (attempt < SAVE_TOKEN_MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }

  return false;
}

/**
 * Register for push notifications and persist the token for a user.
 */
export async function syncPushTokenForUser(userId: string): Promise<boolean> {
  const token = await registerForPushNotificationsAsync();
  if (!token) {
    return false;
  }

  const saved = await savePushToken(userId, token);
  if (!saved) {
    console.warn('Failed to persist push token after registration');
  }
  return saved;
}

/**
 * Re-sync push token when the app returns to foreground (throttled).
 */
export async function syncPushTokenOnForeground(userId: string): Promise<void> {
  if (AppState.currentState !== 'active') {
    return;
  }

  const now = Date.now();
  if (now - lastForegroundSyncAt < FOREGROUND_SYNC_MIN_INTERVAL_MS) {
    return;
  }

  lastForegroundSyncAt = now;
  await syncPushTokenForUser(userId);
}

/**
 * Listen for Expo push token rotation and persist updates.
 */
export function addPushTokenRefreshListener(
  userId: string
): Notifications.EventSubscription {
  if (!expoNotifications) {
    return { remove: () => {} } as Notifications.EventSubscription;
  }

  return expoNotifications.addPushTokenListener(async ({ data: token }) => {
    await savePushToken(userId, token);
  });
}

/**
 * Send a push notification via the Edge Function
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('send-push-notification', {
      body: { user_id: userId, title, body, data },
    });

    if (error) {
      if (__DEV__) console.error('Error sending push notification:', error);
    }
  } catch (error) {
    if (__DEV__) console.error('Error sending push notification:', error);
  }
}

/**
 * Broadcast a push notification to all users with a given role.
 *
 * Resolving the target users happens server-side inside the Edge Function using
 * the service_role key, so RLS restrictions on the client do not apply.
 * This is the correct way to notify owners/managers from a member's session.
 *
 * @param role            - The role to broadcast to ('owner' | 'manager' | 'member')
 * @param title           - Notification title
 * @param body            - Notification body
 * @param data            - Optional payload attached to the notification
 * @param excludeUserIds  - User IDs to exclude (e.g. manager already notified separately)
 */
export async function sendPushNotificationToRole(
  role: 'owner' | 'manager' | 'member',
  title: string,
  body: string,
  data?: Record<string, unknown>,
  excludeUserIds?: string[]
): Promise<void> {
  try {
    const payload: Record<string, unknown> = { to_role: role, title, body, data };
    if (excludeUserIds && excludeUserIds.length > 0) {
      payload.exclude_user_ids = excludeUserIds;
    }

    const { error } = await supabase.functions.invoke('send-push-notification', {
      body: payload,
    });

    if (error) {
      if (__DEV__) console.error('Error sending role push notification:', error);
    }
  } catch (error) {
    if (__DEV__) console.error('Error sending role push notification:', error);
  }
}

/**
 * Add notification response listener (when user taps a notification)
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.EventSubscription {
  if (!expoNotifications) {
    return { remove: () => {} } as Notifications.EventSubscription;
  }
  return expoNotifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Add notification received listener (when notification arrives while app is open)
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.EventSubscription {
  if (!expoNotifications) {
    return { remove: () => {} } as Notifications.EventSubscription;
  }
  return expoNotifications.addNotificationReceivedListener(callback);
}
