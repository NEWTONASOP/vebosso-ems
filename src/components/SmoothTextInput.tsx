// ============================================================================
// VEBOSSO EMS — Smooth text input
// A drop-in for React Native's TextInput that keeps the typed text in the box
// itself instead of feeding `value` back on every key. Feeding it back (a
// "controlled" input) made some Android keyboards drop or repeat letters,
// mostly with word suggestions on and inside popups. The check-in plan and day
// report were fixed this way before (PaperOutlinedField); this makes it the
// default everywhere.
//
// Screens keep using `value` + `onChangeText` as usual. The box only takes a
// new `value` when the screen changes it to something other than what was
// typed — cleared after sending (kept focused), or filled from saved data.
//
// Number / phone keyboards stay plain controlled inputs: those screens often
// reshape what is typed (e.g. strip letters from an amount), and they have no
// word suggestions, which is where the problem comes from.
//
// Every box also joins the nearest FieldChainScope, so Enter / Next moves on
// to the next box (see FieldChain).
// ============================================================================

import { NavigationContext } from 'expo-router/build/react-navigation/core/NavigationContext';
import { forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { TextInput, TextInputProps } from 'react-native';
import { newFieldId, useFieldChainScope } from './FieldChain';

const NUMERIC_KEYBOARDS = new Set(['numeric', 'number-pad', 'decimal-pad', 'phone-pad']);

export const SmoothTextInput = forwardRef<TextInput, TextInputProps>(function SmoothTextInput(props, ref) {
  // Enter / Next to the next box (FieldChain): for single-line boxes that
  // don't already do something of their own on Enter.
  const chain = useFieldChainScope();
  const [id] = useState(newFieldId);
  const inner = useRef<TextInput | null>(null);
  const editable = props.editable !== false;
  // The screen this box is on; none inside a popup (always in front).
  const navigation = useContext(NavigationContext);

  useEffect(() => {
    if (!chain) return;
    chain.register(id, {
      input: () => inner.current,
      editable,
      active: () => (navigation ? navigation.isFocused() : true),
    });
    return () => chain.register(id, null);
  }, [chain, id, editable, navigation]);

  const setRef = useCallback(
    (el: TextInput | null) => {
      inner.current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) ref.current = el;
    },
    [ref],
  );

  const auto = !!chain && !props.multiline && !props.onSubmitEditing;
  const chained: TextInputProps = auto
    ? {
        returnKeyType: props.returnKeyType ?? 'next',
        submitBehavior: 'submit',
        blurOnSubmit: false,
        onSubmitEditing: () => chain!.next(id),
      }
    : {};

  if (props.keyboardType && NUMERIC_KEYBOARDS.has(props.keyboardType)) {
    return <TextInput ref={setRef} {...props} {...chained} />;
  }
  return <UncontrolledTextInput ref={setRef} {...props} {...chained} />;
});

/**
 * For react-native-paper's TextInput: `render={renderSmoothInput}` makes the
 * box inside it a SmoothTextInput, keeping Paper's label and outline.
 */
export const renderSmoothInput = (props: TextInputProps & { ref?: React.Ref<TextInput> }) => (
  <SmoothTextInput {...props} />
);

const UncontrolledTextInput = forwardRef<TextInput, TextInputProps>(function UncontrolledTextInput(
  { value, defaultValue, onChangeText, ...rest },
  ref,
) {
  const inner = useRef<TextInput>(null);
  useImperativeHandle(ref, () => inner.current as TextInput);

  // What is in the box right now, as far as this component knows.
  const typed = useRef(value ?? defaultValue ?? '');
  // What the box starts with, and a key to start it over with new text.
  const [seed, setSeed] = useState(value ?? defaultValue ?? '');
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    // Uncontrolled use (no value given): nothing to follow.
    if (value === undefined || value === null) return;
    if (value === typed.current) return;
    typed.current = value;
    if (value === '') {
      // Cleared by the screen (e.g. after sending): empty it, keep the keyboard up.
      inner.current?.clear();
    } else {
      // Filled by the screen (saved data, a reset): start the box over with it.
      setSeed(value);
      setGeneration((g) => g + 1);
    }
  }, [value]);

  return (
    <TextInput
      key={generation}
      ref={inner}
      {...rest}
      defaultValue={seed}
      onChangeText={(text) => {
        typed.current = text;
        onChangeText?.(text);
      }}
    />
  );
});
