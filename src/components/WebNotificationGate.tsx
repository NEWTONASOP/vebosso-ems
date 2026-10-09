// ============================================================================
// VEBOSSO EMS — Web: allow notifications first
// Like the phone app's permission screen: once signed in on the web, the app
// opens only after this browser allows notifications (and is subscribed, so
// notices arrive even with the tab closed — lib/webPush, 057). Browsers only
// ask after a tap, so it's a screen with a button rather than a pop-up.
//
// Never a dead end: browsers that can't do web notifications at all (e.g.
// iPhone Safari outside the Home Screen) go straight in, and if the browser
// itself fails to subscribe, the person can carry on for this visit.
// Phones never see this — they have PermissionGate.
// ============================================================================

import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { AppTheme as T, appShadow } from "../constants/theme";
import {
  enableWebPush,
  WebPushState,
  webPushState,
  webPushSupported,
} from "../lib/webPush";
import { useAuthStore } from "../store/authStore";

/** Off for now: the web opens without asking. Set true to require it again. */
const GATE_ON = false;

/** Brave says so itself (navigator.brave); it blocks web push by default. */
const isBrave = () => typeof navigator !== 'undefined' && !!(navigator as any).brave;

export function WebNotificationGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const needsGate = useAuthStore(
    (s) =>
      GATE_ON &&
      Platform.OS === "web" &&
      s.isAuthenticated &&
      !!s.profile &&
      !s.profile.must_change_password,
  );
  const [state, setState] = useState<WebPushState | null>(null);
  const [busy, setBusy] = useState(false);
  // The browser's own reason, shown small — it's what tells the cases apart.
  const [failed, setFailed] = useState<string | null>(null);
  // The browser couldn't subscribe — let them in for this visit.
  const [skipped, setSkipped] = useState(false);

  const check = useCallback(async () => {
    if (!webPushSupported()) return setState("unsupported");
    try {
      setState(await webPushState());
    } catch {
      setState("unsupported");
    }
  }, []);

  useEffect(() => {
    if (!needsGate) return;
    void check();
    // Allowed from the address bar's site settings? Pick it up on return.
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [needsGate, check]);

  if (!needsGate || skipped || state === "on" || state === "unsupported")
    return <>{children}</>;

  if (state === null) {
    return (
      <>
        {children}
        <View style={styles.loading}>
          <ActivityIndicator color={T.charcoal} />
        </View>
      </>
    );
  }

  const blocked = state === "blocked";

  const allow = async () => {
    setBusy(true);
    setFailed(null);
    try {
      setState(await enableWebPush());
    } catch (e) {
      if (__DEV__) console.warn("Web push subscribe failed:", e);
      setFailed([(e as any)?.name, (e as any)?.message].filter(Boolean).join(': ') || String(e));
    } finally {
      setBusy(false);
    }
  };

  // Over the app rather than instead of it: the router stays mounted.
  return (
    <>
      {children}
      <View style={styles.root}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.inner}>
            <View style={styles.iconWrap}>
              <Feather name="bell" size={26} color={T.charcoal} />
            </View>

            <Text style={styles.title}>Allow notifications to continue</Text>
            <Text style={styles.subtitle}>
              VEBOSSO EMS sends approvals, tasks, reminders and messages as
              notifications — in this browser too, even when the tab is closed.
            </Text>

            {blocked ? (
              <View style={styles.notice}>
                <Feather name="alert-triangle" size={14} color={T.amber} />
                <Text style={styles.noticeText}>
                  Notifications are blocked for this site. Click the icon at the
                  left of the address bar (a lock or sliders), set Notifications
                  to “Allow”, then reload the page.
                </Text>
              </View>
            ) : null}

            {failed ? (
              <View style={styles.notice}>
                <Feather name="alert-triangle" size={14} color={T.amber} />
                <Text style={styles.noticeText}>
                  {isBrave()
                    ? 'Brave has notifications switched off. Open brave://settings/privacy, turn on “Use Google services for push messaging”, restart Brave and try again — or use Chrome or Edge.'
                    : /push service/i.test(failed)
                      ? 'This browser couldn’t reach its notification service. A VPN, firewall or office network can block it, and some browsers (Opera, Vivaldi) don’t support it — try Chrome or Edge on a normal connection.'
                      : 'This browser couldn’t turn notifications on. Try again, or use Chrome or Edge.'}
                  {'\n'}
                  <Text style={styles.detail}>Details: {failed}</Text>
                </Text>
              </View>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && { opacity: 0.9 },
              ]}
              onPress={blocked ? () => window.location.reload() : allow}
              disabled={busy}
              accessibilityRole="button"
            >
              {busy ? (
                <ActivityIndicator color={T.white} size="small" />
              ) : (
                <>
                  <Feather
                    name={blocked ? "refresh-cw" : "bell"}
                    size={16}
                    color={T.white}
                  />
                  <Text style={styles.primaryBtnText}>
                    {blocked
                      ? "I’ve allowed it — reload"
                      : "Allow notifications"}
                  </Text>
                </>
              )}
            </Pressable>

            {failed ? (
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => setSkipped(true)}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryBtnText}>
                  Continue without notifications for now
                </Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 1000,
    backgroundColor: T.bg,
  },
  loading: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 1000,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.bg,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  inner: { width: "100%", maxWidth: 460, alignSelf: "center" },
  iconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: T.card,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    ...appShadow,
  },
  title: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: 24,
    color: T.ink,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: T.inkSoft,
    marginTop: 8,
  },
  notice: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    backgroundColor: T.amberSoft,
    borderRadius: 14,
    padding: 12,
    marginTop: 16,
  },
  detail: { fontFamily: 'Inter_400Regular', fontSize: 11.5, color: T.mute },
  noticeText: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 12.5,
    lineHeight: 18,
    color: T.ink,
  },
  primaryBtn: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 999,
    backgroundColor: T.charcoal,
  },
  primaryBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: T.white,
  },
  secondaryBtn: {
    marginTop: 10,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13.5,
    color: T.inkSoft,
  },
});
