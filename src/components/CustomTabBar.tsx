import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { BottomTabBarProps } from 'expo-router/tabs';
import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Colors } from '../constants/colors';

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
  const currentRoute = state.routes[state.index];
  const currentOptions = descriptors[currentRoute.key]?.options;

  // Hide the tab bar entirely on detail/modal screens (those with href: null or dynamic segments)
  const shouldHide =
    (currentOptions as any)?.href === null ||
    currentRoute.name.includes('[') ||
    currentRoute.name.includes('/');

  if (shouldHide) return null;

  return (
    <View style={styles.outerContainer}>
      <BlurView
        tint="light"
        intensity={80}
        style={styles.blurContainer}
      >
        <View style={styles.innerContainer}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            
            const hasDashboard = state.routes.some((r) => r.name === 'dashboard');
            const hasMyTeam = state.routes.some((r) => r.name === 'my-team');

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
}

function TabItem({ isFocused, label, iconName, renderIcon, onPress }: TabItemProps) {
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

  const color = isFocused ? Colors.tabActive : Colors.tabInactive;
  const iconElement = renderIcon
    ? renderIcon({ focused: isFocused, color, size: 22 })
    : <Feather name={iconName as any} size={22} color={color} />;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tabButton}
    >
      <Animated.View
        style={[
          styles.pillContainer,
          isFocused && styles.pillActive,
          animatedStyle,
        ]}
      >
        {iconElement}
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            isFocused ? styles.labelActive : styles.labelInactive,
          ]}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 32 : 28,
    left: 16,
    right: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 8,
  },
  blurContainer: {
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    width: '100%',
    maxWidth: 550,
    backgroundColor: Platform.OS === 'web' 
      ? 'rgba(255, 255, 255, 0.85)' 
      : Platform.OS === 'android' 
        ? 'rgba(255, 255, 255, 0.75)' 
        : 'rgba(255, 255, 255, 0.2)',
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
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
  },
  pillContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 24,
    minHeight: 64,
    gap: 4,
  },
  pillActive: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)', // Light grey active capsule background
  },
  iconActive: {
    // Styling tweak for active icon if needed
  },
  label: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: -0.1,
    textAlign: 'center',
  },
  labelActive: {
    color: Colors.tabActive,
  },
  labelInactive: {
    color: Colors.tabInactive,
  },
});
