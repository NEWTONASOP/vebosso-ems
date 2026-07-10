// ============================================================================
// VEBOSSO EMS — Paper Outlined Field (uncontrolled by default for smooth typing)
// ============================================================================

import { StyleSheet, ViewStyle } from 'react-native';
import { TextInput as PaperTextInput } from 'react-native-paper';
import { Colors } from '../constants/colors';

const INPUT_THEME = {
  colors: {
    onSurfaceVariant: Colors.textTertiary,
    surface: Colors.inputBackground,
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
  style?: ViewStyle;
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
      outlineColor={Colors.border}
      activeOutlineColor={Colors.accent}
      textColor={Colors.text}
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
    backgroundColor: Colors.inputBackground,
    marginBottom: 4,
  },
  multilineContent: {
    minHeight: 100,
    maxHeight: 180,
    paddingTop: 12,
  },
});
