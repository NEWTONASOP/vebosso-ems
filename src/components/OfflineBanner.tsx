// ============================================================================
// VEBOSSO EMS — Offline Banner Component
// ============================================================================

import { Feather } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AppTheme, AppSpace } from '../constants/theme';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const translateY = useSharedValue(-50);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = !state.isConnected || !state.isInternetReachable;
      setIsOffline(offline);

      if (offline) {
        translateY.value = withSpring(0, { damping: 15 });
        opacity.value = withTiming(1, { duration: 300 });
      } else {
        translateY.value = withTiming(-50, { duration: 300 });
        opacity.value = withTiming(0, { duration: 300 });
      }
    });

    return () => unsubscribe();
  }, [opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!isOffline) return null;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Feather name="wifi-off" size={14} color={AppTheme.amber} style={styles.icon} />
      <Text style={styles.text}>You&apos;re offline. Some features may not work.</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: AppTheme.amberSoft,
    paddingVertical: 12,
    paddingHorizontal: AppSpace.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  icon: {
    marginRight: 8,
  },
  text: {
    color: AppTheme.amber,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
});
