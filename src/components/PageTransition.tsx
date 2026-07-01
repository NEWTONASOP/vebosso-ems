import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInRight, SlideOutLeft, Easing } from 'react-native-reanimated';

interface PageTransitionProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function PageTransition({ children, style }: PageTransitionProps) {
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
