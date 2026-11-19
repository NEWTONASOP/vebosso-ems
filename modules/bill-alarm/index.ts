// ============================================================================
// VEBOSSO EMS — Event alarms (local native module, Android only)
// Alarms that ring like a clock alarm, set from the app. Missing on the web,
// on iPhone, in Expo Go and in app builds from before this module: every
// call then does nothing.
// ============================================================================

import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

export interface EventAlarm {
  /** Unique, e.g. "<bill id>:2". */
  key: string;
  /** When it rings (ms since 1970). */
  at: number;
  title: string;
  body: string;
  billId: string | null;
}

export interface AlarmStatus {
  /** Android 12+: "Alarms & reminders" allowed. */
  exactAlarms: boolean;
  /** Android 14+: may show the alarm page over the lock screen. */
  fullScreen: boolean;
  notifications: boolean;
  scheduled: number;
  next: number | null;
}

type BillAlarmModule = {
  replaceAll(alarms: EventAlarm[]): number;
  status(): AlarmStatus | null;
  test(seconds: number): boolean;
  openSettings(which: 'exactAlarms' | 'fullScreen' | 'notifications'): boolean;
};

const native = Platform.OS === 'android' ? requireOptionalNativeModule<BillAlarmModule>('BillAlarm') : null;

export const isAvailable = () => native !== null;

export const replaceAll = (alarms: EventAlarm[]) => native?.replaceAll(alarms) ?? 0;

export const status = (): AlarmStatus | null => native?.status() ?? null;

export const test = (seconds = 60) => native?.test(seconds) ?? false;

export const openSettings = (which: 'exactAlarms' | 'fullScreen' | 'notifications') => native?.openSettings(which) ?? false;
