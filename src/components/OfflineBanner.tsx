// ============================================================================
// VEBOSSO EMS — Offline Banner Component
// ============================================================================

import React, { useEffect, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { Colors } from '../constants/colors';

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
      <Text style={styles.icon}>📡</Text>
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
    backgroundColor: Colors.warning,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  icon: {
    marginRight: 8,
    fontSize: 14,
  },
  text: {
    color: Colors.textInverse,
    fontSize: 13,
    fontWeight: '600',
  },
});
