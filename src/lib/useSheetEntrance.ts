// ============================================================================
// VEBOSSO EMS — Sheet / dialog entrance
// Paper's Modal only fades in when `visible` flips from false to true, but our
// sheets mount already open (they exist only while shown), so they appeared
// with no motion. This runs once on mount: bottom sheets slide up and fade in,
// centred dialogs grow slightly and fade in. Pass the result into the Modal's
// contentContainerStyle (Paper animates that container).
// ============================================================================

import { useEffect, useState } from 'react';
import { Animated, Easing, Platform } from 'react-native';

export function useSheetEntrance(kind: 'sheet' | 'dialog' = 'sheet') {
  // useState, not useAnimatedValue — react-native-web doesn't have that hook.
  const [shown] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(shown, {
      toValue: 1,
      // Short and quick to settle: a long slide reads as lag.
      duration: kind === 'sheet' ? 200 : 160,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      // The web has no native driver (it would only log a warning).
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [shown, kind]);

  return kind === 'sheet'
    ? { opacity: shown, transform: [{ translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }
    : { opacity: shown, transform: [{ scale: shown.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }] };
}
