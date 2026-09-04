// ============================================================================
// VEBOSSO EMS — Member permission gate
// ============================================================================
// A member's app is unusable without notifications (approvals, task pushes) and
// background location, so both are required up front rather than failing
// quietly later. Owners and managers never see this.
//
// Copy is deliberately short: the OS dialog that follows carries the formal
// disclosure, and this screen only has to get the member to it.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Linking from 'expo-linking';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppTheme as T, appShadow } from '../constants/theme';
import {
  getLocationPermissionState,
  isLocationServicesEnabled,
  requestLocationPermissions,
} from '../lib/locationTracking';
import {
  getNotificationPermissionState,
  requestNotificationPermission,
} from '../lib/notifications';
import { AnimatedPressable } from './AnimatedPressable';

interface GateState {
  notifications: boolean;
  locationForeground: boolean;
  locationBackground: boolean;
  servicesEnabled: boolean;
  /**
   * False if the member chose "Approximate" on Android's precise/approximate
   * picker (or iOS 14+'s reduced-accuracy toggle). Attendance needs real
   * GPS-grade fixes, so this counts as not satisfying the gate.
   */
  isPrecise: boolean;
  /** The OS will not prompt again — only Settings can fix it now. */
  blocked: boolean;
}

const INITIAL: GateState = {
  notifications: false,
  locationForeground: false,
  locationBackground: false,
  servicesEnabled: true,
  isPrecise: true,
  blocked: false,
};

async function readState(): Promise<GateState> {
  const [notifications, location, servicesEnabled] = await Promise.all([
    getNotificationPermissionState(),
    getLocationPermissionState(),
    isLocationServicesEnabled(),
  ]);

  return {
    notifications: notifications.granted,
    locationForeground: location.foreground,
    locationBackground: location.background,
    servicesEnabled,
    isPrecise: location.isPrecise,
    blocked: location.blocked || (!notifications.granted && !notifications.canAskAgain),
  };
}

export function isGateSatisfied(state: GateState): boolean {
  // Device-wide location being switched off is checked alongside the grants:
  // it silences the trail just as effectively, and the app is not usable in
  // that state either. Approximate-only location is checked the same way —
  // it technically "counts" as granted to Android, but resolves to
  // neighbourhood-sized circles that the trail's 80 m stop radius and 150 m
  // accuracy filter can't work with, so it isn't usable either.
  return (
    state.notifications &&
    state.locationForeground &&
    state.locationBackground &&
    state.servicesEnabled &&
    state.isPrecise
  );
}

function openSettings() {
  if (Platform.OS === 'android') {
    IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
      { data: 'package:com.vebosso.ems' }
    ).catch(() => Linking.openSettings());
    return;
  }
  Linking.openSettings();
}

export function PermissionGate({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<GateState>(INITIAL);
  const [isChecking, setIsChecking] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);

  const refresh = useCallback(async () => {
    const next = await readState();
    setState(next);
    setIsChecking(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Android 11+ sends the user to Settings for "Allow all the time", so the
  // answer arrives on the way back into the app rather than from the prompt.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const handleGrant = async () => {
    setIsRequesting(true);
    try {
      if (!state.notifications) {
        await requestNotificationPermission();
        // Firing a second system permission dialog in the same tick the first
        // one closes is a known Android/RN gotcha: the Activity hasn't fully
        // returned to `resumed` yet, so the next dialog silently never shows —
        // not an error, just dropped. A short gap lets it settle first.
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
      const location = await requestLocationPermissions();
      setState((prev) => ({
        ...prev,
        locationForeground: location.foreground,
        locationBackground: location.background,
        isPrecise: location.isPrecise,
        blocked: location.blocked,
      }));
      await refresh();
    } catch (error) {
      // The in-app prompt can fail to appear at all on some devices — a known
      // Android issue in the underlying location library. There's nothing
      // useful to do with the error here beyond not crashing: the "Open
      // settings manually" link below is the actual way through it.
      if (__DEV__) console.error('Permission request failed:', error);
    } finally {
      setIsRequesting(false);
    }
  };

  if (isChecking) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={T.charcoal} />
      </View>
    );
  }

  if (isGateSatisfied(state)) return <>{children}</>;

  // Android only offers the Precise/Approximate choice once per grant — a
  // repeat in-app request won't show it again, so re-requesting can't fix
  // this the way it fixes an outright denial. Settings is the only way out,
  // same as the fully-blocked case below.
  const needsPreciseLocation =
    state.locationForeground && state.locationBackground && !state.isPrecise;
  const needsSettings = state.blocked || needsPreciseLocation;
  const items = [
    {
      key: 'notifications',
      icon: 'bell' as const,
      title: 'Notifications',
      body: 'Approvals, task assignments and the end-of-day checkout reminder.',
      done: state.notifications,
    },
    {
      key: 'location',
      icon: 'map-pin' as const,
      title: 'Location — Precise, allow all the time',
      body: 'Only used while you’re checked in — it stops the moment you check out. Choose “Allow all the time” and “Precise” (not “Approximate”) so attendance can tell where you actually were.',
      done:
        state.locationForeground &&
        state.locationBackground &&
        state.servicesEnabled &&
        state.isPrecise,
    },
  ];

  return (
    <View style={[styles.root, { paddingTop: insets.top + 24 }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconWrap}>
          <Feather name="shield" size={26} color={T.charcoal} />
        </View>

        <Text style={styles.title}>Two permissions to get started</Text>
        <Text style={styles.subtitle}>
          VEBOSSO EMS needs both before you can use the app.
        </Text>

        <View style={styles.list}>
          {items.map((item) => (
            <View key={item.key} style={styles.row}>
              <View style={[styles.rowIcon, item.done && styles.rowIconDone]}>
                <Feather
                  name={item.done ? 'check' : item.icon}
                  size={16}
                  color={item.done ? T.green : T.charcoal}
                />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowBody}>{item.body}</Text>
              </View>
            </View>
          ))}
        </View>

        {!state.servicesEnabled ? (
          <View style={styles.notice}>
            <Feather name="alert-triangle" size={14} color={T.amber} />
            <Text style={styles.noticeText}>
              Location services are off on this device. Turn them on in your system settings.
            </Text>
          </View>
        ) : null}

        {needsPreciseLocation ? (
          <View style={styles.notice}>
            <Feather name="alert-triangle" size={14} color={T.amber} />
            <Text style={styles.noticeText}>
              Location is set to “Approximate”, which isn’t accurate enough for attendance.
              {Platform.OS === 'android'
                ? ' Open Settings → Permissions → Location and switch to “Use precise location”.'
                : ' Open Settings → Location and turn on “Precise Location”.'}
            </Text>
          </View>
        ) : needsSettings ? (
          <View style={styles.notice}>
            <Feather name="alert-triangle" size={14} color={T.amber} />
            <Text style={styles.noticeText}>
              {Platform.OS === 'android'
                ? 'Android no longer shows the prompt. Open Settings → Permissions → Location and choose “Allow all the time”.'
                : 'Open Settings and set Location to “Always”.'}
            </Text>
          </View>
        ) : null}

        <AnimatedPressable
          scaleTo={0.97}
          style={styles.primaryBtn}
          onPress={needsSettings ? openSettings : handleGrant}
          disabled={isRequesting}
          accessibilityRole="button"
          accessibilityLabel={needsSettings ? 'Open settings' : 'Grant permissions'}
        >
          {isRequesting ? (
            <ActivityIndicator color={T.white} size="small" />
          ) : (
            <>
              <Feather name={needsSettings ? 'settings' : 'unlock'} size={16} color={T.white} />
              <Text style={styles.primaryBtnText}>
                {needsSettings ? 'Open settings' : 'Allow permissions'}
              </Text>
            </>
          )}
        </AnimatedPressable>

        {!needsSettings ? (
          // The in-app prompt can silently fail to appear on some devices — a
          // known Android issue in the underlying location library, not
          // something this screen can detect or retry its way out of. This
          // stays visible even when Android still says it *could* prompt, so
          // nobody is stuck with only a button that does nothing. Returning
          // from Settings re-checks automatically (AppState listener above),
          // so there's nothing left for a manual "Check again" to do.
          <AnimatedPressable
            scaleTo={0.98}
            style={styles.secondaryBtn}
            onPress={openSettings}
            accessibilityRole="button"
            accessibilityLabel="Open settings manually"
          >
            <Text style={styles.secondaryBtnText}>Open settings manually</Text>
          </AnimatedPressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: T.bg,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.bg,
  },
  content: {
    paddingHorizontal: 24,
    flexGrow: 1,
    justifyContent: 'center',
  },
  iconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: T.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 24,
    color: T.ink,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: T.inkSoft,
    marginTop: 8,
  },
  list: {
    marginTop: 24,
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: T.card,
    borderRadius: 18,
    padding: 16,
    ...appShadow,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: T.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconDone: {
    backgroundColor: T.greenSoft,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14.5,
    color: T.ink,
  },
  rowBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12.5,
    lineHeight: 18,
    color: T.inkSoft,
    marginTop: 3,
  },
  notice: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: T.amberSoft,
    borderRadius: 14,
    padding: 12,
    marginTop: 16,
  },
  noticeText: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 12.5,
    lineHeight: 18,
    color: T.ink,
  },
  primaryBtn: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 999,
    backgroundColor: T.charcoal,
  },
  primaryBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: T.white,
  },
  secondaryBtn: {
    marginTop: 10,
    height: 44,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: T.inkSoft,
  },
});
