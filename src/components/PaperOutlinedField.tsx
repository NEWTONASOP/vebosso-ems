// ============================================================================
// VEBOSSO EMS — Paper Outlined Field (uncontrolled by default for smooth typing)
// ============================================================================

import { StyleProp, StyleSheet, TextStyle } from 'react-native';
import { TextInput as PaperTextInput } from 'react-native-paper';
import { AppTheme } from '../constants/theme';

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
  keyboardType?: 'default' | 'numbers-and-punctuation';
  style?: StyleProp<TextStyle>;
  dense?: boolean;
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

export function PaperOutlinedField({
  label,
  onChangeText,
  placeholder,
  multiline,
  maxLength,
  editable = true,
  keyboardType = 'default',
  style,
  dense,
  ...rest
}: PaperOutlinedFieldProps) {
  return (
    <PaperTextInput
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
      contentStyle={multiline ? styles.multilineContent : undefined}
      theme={INPUT_THEME}
      blurOnSubmit={!multiline}
      {...rest}
    />
  );
}

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
});
