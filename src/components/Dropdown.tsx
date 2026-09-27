// ============================================================================
// VEBOSSO EMS — Dropdown motion
// One feel for every expand / collapse in the app:
//   DropdownBody — the content fades and slides in when it opens
//   Chevron      — turns to point up while open
// Both are plain style animations (opacity / transform on the element itself).
// Reanimated's layout animations (entering / exiting / layout) are avoided on
// purpose: they left the rows below a dropdown painted in their old place,
// overlapping the list.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { ReactNode, useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const EASE = Easing.bezier(0.22, 1, 0.36, 1);

export function DropdownBody({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const shown = useSharedValue(0);

  useEffect(() => {
    shown.value = withTiming(1, { duration: 240, easing: EASE });
  }, [shown]);

  const fade = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * -8 }],
  }));

  return <Animated.View style={[style, fade]}>{children}</Animated.View>;
}

export function Chevron({ open, size = 18, color }: { open: boolean; size?: number; color: string }) {
  const turn = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    turn.value = withTiming(open ? 1 : 0, { duration: 240, easing: EASE });
  }, [open, turn]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }));

  return (
    <Animated.View style={style}>
      <Feather name="chevron-down" size={size} color={color} />
    </Animated.View>
  );
}
