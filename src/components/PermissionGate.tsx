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
import { AnimatedPressable } from './AnimatedPressable';
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

interface GateState {
  notifications: boolean;
  locationForeground: boolean;
  locationBackground: boolean;
  servicesEnabled: boolean;
  /** The OS will not prompt again — only Settings can fix it now. */
  blocked: boolean;
}

const INITIAL: GateState = {
  notifications: false,
  locationForeground: false,
  locationBackground: false,
  servicesEnabled: true,
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
    blocked: location.blocked || (!notifications.granted && !notifications.canAskAgain),
  };
}

export function isGateSatisfied(state: GateState): boolean {
  // Device-wide location being switched off is checked alongside the grants:
  // it silences the trail just as effectively, and the app is not usable in
  // that state either.
  return (
    state.notifications &&
    state.locationForeground &&
    state.locationBackground &&
    state.servicesEnabled
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
  // Surfaced instead of left as a silent unhandled rejection — without this,
  // any native-side failure in the request calls below looked identical to
  // "nothing happened" when the button was pressed, with no way to tell why.
  const [requestError, setRequestError] = useState<string | null>(null);

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
    setRequestError(null);
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
        blocked: location.blocked,
      }));
      // The call can resolve cleanly without granting anything — that path
      // threw nothing, so it never hit the catch below, and previously showed
      // no explanation at all. Report exactly what came back.
      if (!location.foreground || !location.background) {
        setRequestError(
          `Location responded without granting access (foreground: ${location.foreground}, background: ${location.background}, blocked: ${location.blocked}).`
        );
      }
      await refresh();
    } catch (error) {
      // A thrown error here previously vanished as an unhandled rejection —
      // the spinner stopped and nothing else happened, indistinguishable from
      // the button doing nothing at all.
      const message = error instanceof Error ? error.message : String(error);
      setRequestError(message);
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

  const needsSettings = state.blocked;
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
      title: 'Location — allow all the time',
      body: 'Required for attendance. Choose “Allow all the time” so it keeps working while you are checked in.',
      done: state.locationForeground && state.locationBackground && state.servicesEnabled,
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

        {needsSettings ? (
          <View style={styles.notice}>
            <Feather name="alert-triangle" size={14} color={T.amber} />
            <Text style={styles.noticeText}>
              {Platform.OS === 'android'
                ? 'Android no longer shows the prompt. Open Settings → Permissions → Location and choose “Allow all the time”.'
                : 'Open Settings and set Location to “Always”.'}
            </Text>
          </View>
        ) : null}

        {requestError ? (
          <View style={styles.notice}>
            <Feather name="alert-triangle" size={14} color={T.amber} />
            <Text style={styles.noticeText}>Couldn’t request permissions: {requestError}</Text>
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

        <View style={styles.secondaryRow}>
          <AnimatedPressable
            scaleTo={0.98}
            style={styles.secondaryBtn}
            onPress={() => void refresh()}
            accessibilityRole="button"
            accessibilityLabel="Check again"
          >
            <Text style={styles.secondaryBtnText}>Check again</Text>
          </AnimatedPressable>

          {!needsSettings ? (
            // The in-app prompt can silently fail to appear on some devices —
            // a known Android issue in the underlying location library, not
            // something this screen can detect or retry its way out of. This
            // stays visible even when Android still says it *could* prompt,
            // so nobody is stuck with only a button that does nothing.
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
        </View>
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
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
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
