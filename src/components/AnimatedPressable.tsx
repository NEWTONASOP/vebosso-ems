// ============================================================================
// VEBOSSO EMS — Animated Pressable with Haptics (iOS Feel)
// ============================================================================

import React from 'react';
import { Pressable, PressableProps, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface AnimatedPressableProps extends Omit<PressableProps, 'style' | 'children'> {
  children: PressableProps['children'];
  style?: PressableProps['style'];
  scaleTo?: number;
  hapticStyle?: Haptics.ImpactFeedbackStyle;
}

const AnimatedPressableComponent = React.forwardRef<any, AnimatedPressableProps>(
  (
    {
      children,
      style,
      onPressIn,
      onPressOut,
      onPress,
      scaleTo = 0.96,
      hapticStyle = Haptics.ImpactFeedbackStyle.Light,
      ...props
    },
    ref
  ) => {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => {
      return {
        transform: [{ scale: scale.value }],
      };
    });

    const handlePressIn = (e: any) => {

      scale.value = withSpring(scaleTo, {
        mass: 0.2,
        damping: 16,
        stiffness: 280,
      });
      if (onPressIn) onPressIn(e);
    };

    const handlePressOut = (e: any) => {

      scale.value = withSpring(1, {
        mass: 0.2,
        damping: 16,
        stiffness: 280,
      });
      if (onPressOut) onPressOut(e);
    };

    const handlePress = (e: any) => {
      Haptics.impactAsync(hapticStyle).catch(() => {});
      if (onPress) onPress(e);
    };

    return (
      <Pressable
        ref={ref}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={(state) => {
          const resolvedStyle = typeof style === 'function' ? style(state) : style;
          const flatStyle = StyleSheet.flatten(resolvedStyle) || {};
          return {
            width: flatStyle.width,
            marginTop: flatStyle.marginTop,
            marginBottom: flatStyle.marginBottom,
            marginLeft: flatStyle.marginLeft,
            marginRight: flatStyle.marginRight,
            margin: flatStyle.margin,
            alignSelf: flatStyle.alignSelf,
            flex: flatStyle.flex,
            // Without this the pressable can't shrink below its content on
            // web, so flexed siblings overflow their track.
            minWidth: flatStyle.flex !== undefined ? 0 : undefined,
          };
        }}
        {...props}
      >
        {(state) => {
          const resolvedStyle = typeof style === 'function' ? style(state) : style;
          const flatStyle = StyleSheet.flatten(resolvedStyle) || {};
          const content = typeof children === 'function' ? children(state) : children;
          return (
            <Animated.View
              style={[
                resolvedStyle,
                animatedStyle,
                {
                  marginTop: 0,
                  marginBottom: 0,
                  marginLeft: 0,
                  marginRight: 0,
                  margin: 0,
                  alignSelf: undefined,
                  // The outer Pressable already owns the width. Repeating it
                  // here would compound a percentage against itself, so fill
                  // the parent instead.
                  width: flatStyle.width !== undefined ? '100%' : undefined,
                  // Likewise for flex: the outer handles distribution among
                  // siblings. Keeping `flex` here would give this view a zero
                  // basis, so a parent sized by its content collapses on web.
                  flex: undefined,
                  flexGrow: flatStyle.flex !== undefined ? 1 : flatStyle.flexGrow,
                  flexShrink: flatStyle.flex !== undefined ? 1 : flatStyle.flexShrink,
                  flexBasis: flatStyle.flex !== undefined ? 'auto' : flatStyle.flexBasis,
                },
              ]}
            >
              {content}
            </Animated.View>
          );
        }}
      </Pressable>
    );
  }
);

AnimatedPressableComponent.displayName = 'AnimatedPressable';

export const AnimatedPressable = AnimatedPressableComponent;
