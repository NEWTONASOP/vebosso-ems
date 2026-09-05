// ============================================================================
// VEBOSSO EMS — Auth Loading Screen
// Shown while the session is being restored from SecureStore on app launch
// ============================================================================

import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme } from '../constants/theme';

interface LoadingScreenProps {
  /** Shown under the dots — e.g. "Updating…" while an OTA bundle downloads,
   *  so a launch that takes a few seconds longer than usual doesn't look like
   *  the app has simply hung. */
  label?: string;
}

export function LoadingScreen({ label }: LoadingScreenProps = {}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Subtle pulse on the logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [fadeAnim, pulseAnim]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <Image
          source={require('../../assets/images/vebosso-emblem-black.png')}
          style={styles.logo}
          contentFit="contain"
        />
      </Animated.View>
      <View style={styles.dotsGroup}>
        <View style={styles.dotsRow}>
          <Dot delay={0} />
          <Dot delay={180} />
          <Dot delay={360} />
        </View>
        {label ? <Text style={styles.label}>{label}</Text> : null}
      </View>
    </Animated.View>
  );
}

function Dot({ delay }: { delay: number }) {
  const anim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0.3,
          duration: 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [anim, delay]);

  return <Animated.View style={[styles.dot, { opacity: anim }]} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppTheme.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 48,
  },
  logo: {
    width: 120,
    height: 120,
  },
  dotsGroup: {
    alignItems: 'center',
    gap: 14,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: AppTheme.mute,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: AppTheme.charcoal,
  },
});
