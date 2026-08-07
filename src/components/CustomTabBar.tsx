import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { BottomTabBarProps } from 'expo-router/tabs';
import React from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppTheme, RoleAccent, type Role, appShadow } from '../constants/theme';
import { useAuthStore } from '../store/authStore';

const SLIM_WIDTH = 400;

// Map route names to icons
const ICON_MAP: Record<string, string> = {
  home: 'home',
  tasks: 'check-square',
  history: 'calendar',
  announcements: 'bell',
  profile: 'user',
  dashboard: 'grid',
  team: 'users',
  approvals: 'check-circle',
  settings: 'settings',
  'my-team': 'users',
  'my-work': 'briefcase',
};

// Map route names to user-friendly labels
const LABEL_MAP: Record<string, string> = {
  home: 'Home',
  tasks: 'Tasks',
  history: 'History',
  announcements: 'News',
  profile: 'Profile',
  dashboard: 'Dashboard',
  team: 'Team',
  approvals: 'Approvals',
  settings: 'Settings',
  'my-team': 'My Team',
  'my-work': 'My Work',
};

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isSlim = width < SLIM_WIDTH;
  const bottomOffset = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 16) + (isSlim ? 8 : 12);
  const currentRoute = state.routes[state.index];
  const currentOptions = descriptors[currentRoute.key]?.options;
  const profileRole = useAuthStore((s) => s.profile?.role);
  const role: Role =
    profileRole === 'owner' || profileRole === 'manager' || profileRole === 'member'
      ? profileRole
      : 'member';
  const accent = RoleAccent[role];

  // Hide the tab bar entirely on detail/modal screens (those with href: null or dynamic segments)
  const shouldHide =
    (currentOptions as any)?.href === null ||
    currentRoute.name.includes('[') ||
    currentRoute.name.includes('/');

  if (shouldHide) return null;

  return (
    <View
      style={[
        styles.outerContainer,
        isSlim && styles.outerContainerSlim,
        { bottom: bottomOffset },
      ]}
    >
      <BlurView
        tint="light"
        intensity={90}
        style={styles.blurContainer}
      >
        <View style={[styles.innerContainer, isSlim && styles.innerContainerSlim]}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            
            const hasDashboard = state.routes.some((r) => r.name === 'dashboard');

            // Skip hidden tabs (Expo Router uses href: null to hide tabs, or dynamic sub-routes)
            if (
              (options as any).href === null || 
              !ICON_MAP[route.name] || 
              route.name.includes('[') || 
              route.name.includes('/') ||
              // Hide tasks from bottom tab bar in Owner/Manager layouts (they access it via Dashboard)
              (route.name === 'tasks' && hasDashboard)
            ) {
              return null;
            }

            const label =
              (options.tabBarLabel as string) ||
              (options.title as string) ||
              LABEL_MAP[route.name] ||
              route.name;
            const isFocused = state.index === index;

            const iconName = ICON_MAP[route.name] || 'circle';
            const renderIcon = options.tabBarIcon;

            const onPress = () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
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

function TabItem({
  isFocused,
  label,
  iconName,
  renderIcon,
  onPress,
  isSlim,
  activeColor,
  activeSoft,
}: TabItemProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = () => {
    // Reanimated shared values are intentionally mutable outside React state.
    // eslint-disable-next-line react-hooks/immutability -- reanimated shared value
    scale.value = withSpring(0.92, { damping: 10, stiffness: 300 });
  };

  const handlePressOut = () => {
    // eslint-disable-next-line react-hooks/immutability -- reanimated shared value
    scale.value = withSpring(1, { damping: 10, stiffness: 300 });
  };

  const color = isFocused ? activeColor : AppTheme.mute;
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
