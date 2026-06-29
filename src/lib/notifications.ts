// ============================================================================
// VEBOSSO EMS — Push Notification Helpers
// ============================================================================

import type * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { isRunningInExpoGo } from 'expo';

// Lazily load expo-notifications to prevent crash under Expo Go on Android
const expoNotifications = !isRunningInExpoGo()
  ? (require('expo-notifications') as typeof Notifications)
  : null;

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
    const pushToken = await expoNotifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });
    token = pushToken.data;
  } catch (error) {
    console.error('Error getting push token:', error);
    return null;
  }

  // Configure Android notification channel
  if (Platform.OS === 'android') {
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
  }

  return token;
}

/**
 * Save the push token to the user's profile
 */
export async function savePushToken(userId: string, token: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('profiles')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ expo_push_token: token } as any)
      .eq('id', userId);

    if (error) {
      console.error('Error saving push token:', error);
    }
  } catch (error) {
    console.error('Error saving push token:', error);
  }
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
    const { data: response, error } = await supabase.functions.invoke('send-push-notification', {
      body: { user_id: userId, title, body, data },
    });

    if (error) {
      console.error('Error sending push notification:', error);
    }
  } catch (error) {
    console.error('Error sending push notification:', error);
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
