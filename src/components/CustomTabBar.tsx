import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { BottomTabBarProps } from 'expo-router/tabs';
import React, { useEffect } from 'react';
import { Image, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppTheme, RoleAccent, SIDEBAR_WIDTH, type Role, appShadow } from '../constants/theme';
import { useAuthStore } from '../store/authStore';

const SLIM_WIDTH    = 400;
const DESKTOP_WIDTH = 1024;

// Map route names to icons
const ICON_MAP: Record<string, string> = {
  home: 'home', tasks: 'check-square', history: 'calendar',
  announcements: 'bell', profile: 'user', dashboard: 'grid',
  team: 'users', approvals: 'check-circle', settings: 'settings',
  'my-team': 'users', 'my-work': 'briefcase',
  leaves: 'umbrella', venues: 'map-pin', accounts: 'book-open', bills: 'file-text',
};

// Map route names to user-friendly labels
const LABEL_MAP: Record<string, string> = {
  home: 'Home', tasks: 'Tasks', history: 'History',
  announcements: 'News', profile: 'Profile', dashboard: 'Dashboard',
  team: 'Team', approvals: 'Approvals', settings: 'Settings',
  'my-team': 'My Team', 'my-work': 'My Work', leaves: 'Leaves',
  venues: 'Venues', accounts: 'Accounts', bills: 'Bills',
};

const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner', manager: 'Manager', member: 'Member',
};

// ─── Main component ────────────────────────────────────────────────────────────

/**
 * Screens declared with `href: null`. Expo Router strips `href` before the tab
 * bar sees the options and hides the item with `display: 'none'` instead.
 */
function isHiddenTab(options: unknown): boolean {
  const o = options as { href?: unknown; tabBarItemStyle?: { display?: string } } | undefined;
  return o?.href === null || o?.tabBarItemStyle?.display === 'none';
}

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets     = useSafeAreaInsets();
  const { width }  = useWindowDimensions();
  const isSlim     = width < SLIM_WIDTH;
  const isDesktop  = Platform.OS === 'web' && width >= DESKTOP_WIDTH;

  const profileRole = useAuthStore((s) => s.profile?.role);
  const role: Role  = profileRole === 'owner' || profileRole === 'manager' || profileRole === 'member'
    ? profileRole : 'member';
  const accent = RoleAccent[role];

  const currentRoute   = state.routes[state.index];
  const currentOptions = descriptors[currentRoute.key]?.options;

  // Hide the tab bar entirely on detail/modal screens
  const shouldHide =
    isHiddenTab(currentOptions) ||
    currentRoute.name.includes('[') ||
    currentRoute.name.includes('/');

  // On desktop web: inject a CSS rule into <head> that shifts the app root
  // right by SIDEBAR_WIDTH so content is never hidden under the fixed sidebar.
  // Must be placed before any early returns (React hooks rules).
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const styleId = 'vebosso-sidebar-offset';
    if (isDesktop) {
      if (!document.getElementById(styleId)) {
        const el = document.createElement('style');
        el.id = styleId;
        el.textContent = `
          @media (min-width: ${DESKTOP_WIDTH}px) {
            body {
              padding-left: ${SIDEBAR_WIDTH}px !important;
            }
            #root, [data-expo-root] {
              max-width: 1400px;
              margin: 0 auto;
            }
          }
        `;
        document.head.appendChild(el);
      }

    } else {
      document.getElementById(styleId)?.remove();
    }
    return () => { document.getElementById(styleId)?.remove(); };
  }, [isDesktop]);

  if (shouldHide) return null;

  // ── Desktop sidebar ──────────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <View style={sidebarStyles.container}>
        {/* Logo — same mark as the login screen */}
        <View style={sidebarStyles.logoRow}>
          <Image
            source={require('../../assets/images/vebosso-logo-mark.png')}
            style={sidebarStyles.logoMark}
            resizeMode="contain"
          />
        </View>

        {/* Nav items */}
        <View style={sidebarStyles.navList}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const hasDashboard = state.routes.some((r) => r.name === 'dashboard');

            if (
              isHiddenTab(options) ||
              !ICON_MAP[route.name] ||
              route.name.includes('[') ||
              route.name.includes('/') ||
              (route.name === 'tasks' && hasDashboard)
            ) return null;

            const label      = (options.tabBarLabel as string) || (options.title as string) || LABEL_MAP[route.name] || route.name;
            const isFocused  = state.index === index;
            const iconName   = ICON_MAP[route.name] || 'circle';
            const color      = isFocused ? accent.color : AppTheme.mute;
            const renderIcon = options.tabBarIcon;

            const onPress = () => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
            };

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                style={({ pressed }) => [
                  sidebarStyles.navItem,
                  isFocused && { backgroundColor: accent.soft },
                  pressed && { opacity: 0.7 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected: isFocused }}
              >
                <View style={sidebarStyles.navIcon}>
                  {renderIcon
                    ? renderIcon({ focused: isFocused, color, size: 18 })
                    : <Feather name={iconName as any} size={18} color={color} />}
                </View>
                <Text style={[sidebarStyles.navLabel, { color }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Role badge at bottom */}
        <View style={sidebarStyles.roleRow}>
          <View style={[sidebarStyles.rolePill, { backgroundColor: accent.soft }]}>
            <View style={[sidebarStyles.roleDot, { backgroundColor: accent.color }]} />
            <Text style={[sidebarStyles.roleText, { color: accent.color }]}>{ROLE_LABEL[role]}</Text>
          </View>
        </View>
      </View>
    );
  }

  // ── Floating mobile tab bar (unchanged) ──────────────────────────────────────
  const bottomOffset = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 16) + (isSlim ? 8 : 12);

  return (
    <View
      style={[
        styles.outerContainer,
        isSlim && styles.outerContainerSlim,
        { bottom: bottomOffset },
      ]}
    >
      <BlurView tint="light" intensity={90} style={styles.blurContainer}>
        <View style={[styles.innerContainer, isSlim && styles.innerContainerSlim]}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const hasDashboard = state.routes.some((r) => r.name === 'dashboard');

            if (
              isHiddenTab(options) ||
              !ICON_MAP[route.name] ||
              route.name.includes('[') ||
              route.name.includes('/') ||
              (route.name === 'tasks' && hasDashboard)
            ) return null;

            const label     = (options.tabBarLabel as string) || (options.title as string) || LABEL_MAP[route.name] || route.name;
            const isFocused = state.index === index;
            const iconName  = ICON_MAP[route.name] || 'circle';
            const renderIcon = options.tabBarIcon;

            const onPress = () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
            };

            return (
              <TabItem
                key={route.key}
                isFocused={isFocused}
                label={label}
                iconName={iconName}
                renderIcon={renderIcon}
                onPress={onPress}
                isSlim={isSlim}
                activeColor={accent.color}
                activeSoft={accent.soft}
              />
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

// ─── Desktop sidebar styles ────────────────────────────────────────────────────

const sidebarStyles = StyleSheet.create({
  container: {
    width: SIDEBAR_WIDTH,
    backgroundColor: AppTheme.card,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: AppTheme.hairline,
    paddingTop: 28,
    paddingBottom: 24,
    flexDirection: 'column',
    // position:fixed is a web-only style that React Native Web supports
    ...Platform.select({
      web: {
        position: 'fixed' as any,
        top: 0,
        left: 0,
        bottom: 0,
        boxShadow: '2px 0 12px rgba(10,12,17,0.06)',
        zIndex: 100,
      },
    }),
  },
  logoRow: {
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  logoMark: {
    height: 24,
    width: 140,
  },
  navList: {
    flex: 1,
    gap: 4,
    paddingHorizontal: 10,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  navIcon: {
    width: 22,
    alignItems: 'center',
  },
  navLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13.5,
    letterSpacing: -0.1,
  },
  roleRow: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: AppTheme.hairline,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  roleDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  roleText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
});

// ─── Mobile tab item ───────────────────────────────────────────────────────────

interface TabItemProps {
  isFocused: boolean;
  label: string;
  iconName: string;
  renderIcon: ((props: { focused: boolean; color: string; size: number }) => React.ReactNode) | undefined;
  onPress: () => void;
  isSlim: boolean;
  activeColor: string;
  activeSoft: string;
}

function TabItem({ isFocused, label, iconName, renderIcon, onPress, isSlim, activeColor, activeSoft }: TabItemProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn  = () => { (scale as any).value = withSpring(0.92, { damping: 10, stiffness: 300 }); };
  const handlePressOut = () => { (scale as any).value = withSpring(1,    { damping: 10, stiffness: 300 }); };

  const color    = isFocused ? activeColor : AppTheme.mute;
  const iconSize = isSlim ? (isFocused ? 22 : 20) : (isFocused ? 28 : 26);
  const iconElement = renderIcon
    ? renderIcon({ focused: isFocused, color, size: iconSize })
    : <Feather name={iconName as any} size={iconSize} color={color} />;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
      style={[styles.tabButton, isSlim && styles.tabButtonSlim]}
    >
      <Animated.View
        style={[
          styles.pillContainer,
          isSlim && styles.pillContainerSlim,
          isFocused && { backgroundColor: activeSoft },
          animatedStyle,
        ]}
      >
        {iconElement}
      </Animated.View>
    </Pressable>
  );
}

// ─── Mobile tab bar styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerContainerSlim: {
    left: 10,
    right: 10,
  },
  blurContainer: {
    borderRadius: 28,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 550,
    backgroundColor: AppTheme.card,
    ...appShadow,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      },
    }),
  },
  innerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  innerContainerSlim: {
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
    minHeight: 44,
  },
  tabButtonSlim: {
    minWidth: 0,
  },
  pillContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    minHeight: 56,
  },
  pillContainerSlim: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 20,
    minHeight: 44,
  },
});
