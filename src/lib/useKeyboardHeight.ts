// ============================================================================
// VEBOSSO EMS — On-screen keyboard height
// Android draws the app edge-to-edge, so the screen no longer shrinks when the
// keyboard opens and overlays (bottom sheets, dialogs) end up behind it. Lift
// them by this height instead. 0 while the keyboard is closed.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard, Platform, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) =>
      setHeight(e.endCoordinates.height)
    );
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}

/**
 * Style for a bottom sheet (Paper Modal content) so it sits on top of the
 * keyboard and fits in the space above it. null while the keyboard is closed.
 * The modal already keeps clear of the system bars; Android reports the
 * keyboard without the nav bar, iOS with the home-indicator strip.
 */
export function useSheetLift() {
  const keyboard = useKeyboardHeight();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  if (keyboard <= 0) return null;
  const lift = Platform.OS === 'ios' ? Math.max(0, keyboard - insets.bottom) : keyboard;
  return { marginBottom: lift, maxHeight: height - insets.top - insets.bottom - lift - 8 };
}

/**
 * Like useSheetLift, for a centred dialog (Paper Modal content with `margin`
 * all round): moves it up above the keyboard and keeps it within the space
 * left. null while the keyboard is closed. Android only: those dialogs keep
 * a KeyboardAvoidingView for iOS, which already does this there.
 */
export function useDialogLift(margin = 20) {
  const keyboard = useKeyboardHeight();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  if (keyboard <= 0 || Platform.OS !== 'android') return null;
  return {
    marginBottom: margin + keyboard,
    maxHeight: height - insets.top - insets.bottom - keyboard - margin * 2,
  };
}

/**
 * For full-screen forms: how much of the view in `ref` the keyboard covers.
 * Give that view `paddingBottom: overlap` and its ScrollView shrinks to the
 * space above the keyboard, keeping the focused field in sight.
 */
export function useKeyboardOverlap() {
  const ref = useRef<View>(null);
  const [overlap, setOverlap] = useState(0);
  const navBar = useSafeAreaInsets().bottom;

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      // Android reports the keyboard's height without the nav bar under it.
      const keyboardTop = ios
        ? e.endCoordinates.screenY
        : Dimensions.get('screen').height - navBar - e.endCoordinates.height;
      // The view's own box doesn't change with its padding, so re-measuring
      // (e.g. when the keyboard switches to emoji) stays accurate.
      ref.current?.measureInWindow((_x, y, _w, h) => setOverlap(Math.max(0, y + h - keyboardTop)));
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setOverlap(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [navBar]);

  return { ref, overlap };
}
