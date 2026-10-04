import React from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut, Easing } from 'react-native-reanimated';

interface PageTransitionProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

/**
 * A short fade when a screen opens — on the web only. On phones a mount
 * animation on a tab screen opened from another screen (e.g. tapping a
 * notification) could stay stuck at fully transparent, leaving a blank white
 * screen; the screen just appears there instead.
 */
export function PageTransition({ children, style }: PageTransitionProps) {
  if (Platform.OS !== 'web') {
    return <View style={[styles.container, style]}>{children}</View>;
  }
  return (
    <Animated.View
      entering={FadeIn.duration(200).easing(Easing.out(Easing.ease))}
      exiting={FadeOut.duration(150)}
      style={[styles.container, style]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
