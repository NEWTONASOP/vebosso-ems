// ============================================================================
// VEBOSSO EMS — Paper Outlined Field (the app's form text box)
// Outlined box with a floating label, used by every form in a popup (check-in
// plan, day report, task note, expenses, accounts…) so they all look and type
// the same. The text lives in the box itself (SmoothTextInput inside), not fed
// back on every key — feeding it back made some Android keyboards drop or
// repeat letters. Pass `defaultValue` for a box the screen only reads, or
// `value` when the screen also fills it (saved data, a reset).
// ============================================================================

import { forwardRef } from 'react';
import { KeyboardTypeOptions, ReturnKeyTypeOptions, StyleProp, StyleSheet, TextStyle } from 'react-native';
import { TextInput as PaperTextInput } from 'react-native-paper';
import { AppTheme } from '../constants/theme';
import { renderSmoothInput } from './SmoothTextInput';

const INPUT_THEME = {
  colors: {
    onSurfaceVariant: AppTheme.mute,
    surface: AppTheme.card,
  },
};

type BaseProps = {
  label: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  editable?: boolean;
  keyboardType?: KeyboardTypeOptions;
  style?: StyleProp<TextStyle>;
  dense?: boolean;
  autoFocus?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  returnKeyType?: ReturnKeyTypeOptions;
  submitBehavior?: 'submit' | 'blurAndSubmit' | 'newline';
  onSubmitEditing?: () => void;
  /** Multi-line box that grows taller (long task text). */
  tall?: boolean;
};

type UncontrolledProps = BaseProps & {
  defaultValue?: string;
  value?: never;
};

type ControlledProps = BaseProps & {
  value: string;
  defaultValue?: never;
};

export type PaperOutlinedFieldProps = UncontrolledProps | ControlledProps;

/** `ref` gives focus() / blur(), e.g. for useFieldChain's Next key. */
export const PaperOutlinedField = forwardRef<any, PaperOutlinedFieldProps>(function PaperOutlinedField(
  {
    label,
    onChangeText,
    placeholder,
    multiline,
    maxLength,
    editable = true,
    keyboardType = 'default',
    style,
    dense,
    tall,
    ...rest
  },
  ref,
) {
  return (
    <PaperTextInput
      ref={ref}
      mode="outlined"
      label={label}
      onChangeText={onChangeText}
      placeholder={placeholder}
      multiline={multiline}
      maxLength={maxLength}
      editable={editable}
      keyboardType={keyboardType}
      dense={dense}
      outlineColor={AppTheme.soft2}
      activeOutlineColor={AppTheme.charcoal}
      textColor={AppTheme.ink}
      style={[styles.input, style]}
      contentStyle={multiline ? [styles.multilineContent, tall && styles.tallContent] : undefined}
      theme={INPUT_THEME}
      blurOnSubmit={!multiline}
      render={renderSmoothInput}
      {...rest}
    />
  );
});

const styles = StyleSheet.create({
  input: {
    backgroundColor: AppTheme.card,
    borderRadius: 14,
    marginBottom: 4,
  },
  multilineContent: {
    minHeight: 100,
    maxHeight: 180,
    paddingTop: 12,
  },
  tallContent: {
    minHeight: 120,
    maxHeight: 320,
  },
});
