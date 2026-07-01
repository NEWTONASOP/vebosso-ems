import React from 'react';
import { View, StyleSheet, Platform, Pressable } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Text } from 'react-native-paper';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

// Map route names to icons
const ICON_MAP: Record<string, string> = {
  home: 'home',
  tasks: 'check-square',
  history: 'calendar',
  announcements: 'bell',
  profile: 'user',
  dashboard: 'sliders',
  members: 'users',
  approvals: 'clipboard',
  settings: 'settings',
};

// Map route names to user-friendly labels
const LABEL_MAP: Record<string, string> = {
  home: 'Home',
  tasks: 'Tasks',
  history: 'History',
  announcements: 'News',
  profile: 'Profile',
  dashboard: 'Dashboard',
  members: 'Members',
  approvals: 'Approvals',
  settings: 'Settings',
};

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
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
            const label = LABEL_MAP[route.name] || route.name;
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
    scale.value = withSpring(0.92, { damping: 10, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 10, stiffness: 300 });
  };

  const color = isFocused ? '#000000' : '#8E8E93';
  const iconElement = renderIcon
    ? renderIcon({ focused: isFocused, color, size: 18 })
    : <Feather name={iconName as any} size={18} color={color} />;

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
    bottom: Platform.OS === 'ios' ? 28 : 20,
    left: 20,
    right: 20,
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
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    width: '100%',
    maxWidth: 500,
    backgroundColor: Platform.OS === 'web' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.2)',
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
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 24,
    width: '90%',
    minHeight: 52,
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
    fontSize: 10,
    letterSpacing: -0.1,
  },
  labelActive: {
    color: '#000000',
  },
  labelInactive: {
    color: '#8E8E93',
  },
});
