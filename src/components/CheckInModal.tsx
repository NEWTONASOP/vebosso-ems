// ============================================================================
// VEBOSSO EMS — Check-In Modal
// ============================================================================

import { useCallback, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Button, HelperText, Modal, Portal, Text } from 'react-native-paper';
import { Colors } from '../constants/colors';
import { PaperOutlinedField } from './PaperOutlinedField';

interface CheckInModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (plan: string) => Promise<void>;
  isLoading?: boolean;
}

export function CheckInModal({
  visible,
  onDismiss,
  onSubmit,
  isLoading,
}: CheckInModalProps) {
  const planRef = useRef('');
  const [charCount, setCharCount] = useState(0);
  const [error, setError] = useState('');

  const handleChangeText = useCallback((text: string) => {
    planRef.current = text;
    setCharCount(text.length);
    setError((prev) => (prev ? '' : prev));
  }, []);

  const handleSubmit = useCallback(async () => {
    const plan = planRef.current;
    if (!plan.trim()) {
      setError('Please enter your plan for today');
      return;
    }

    setError('');
    await onSubmit(plan.trim().slice(0, 1000));
  }, [onSubmit]);

  if (!visible) return null;

  return (
    <Portal>
      <Modal
        visible
        onDismiss={onDismiss}
        contentContainerStyle={styles.container}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <Text style={styles.emoji}>🌅</Text>
            <Text style={styles.title}>Start Your Day</Text>
            <Text style={styles.subtitle}>What will you work on today?</Text>
          </View>

          <PaperOutlinedField
            label="Today's Plan"
            placeholder="Describe what you'll be working on today..."
            defaultValue=""
            onChangeText={handleChangeText}
            multiline
            maxLength={2000}
            editable={!isLoading}
          />

          <View style={styles.charCountRow}>
            {error ? (
              <HelperText type="error" visible={!!error} style={styles.errorText}>
                {error}
              </HelperText>
            ) : (
              <Text style={[styles.charCount, charCount > 0 && styles.charCountValid]}>
                {charCount} / 2000
              </Text>
            )}
          </View>

          <View style={styles.actions}>
            <Button
              mode="outlined"
              onPress={onDismiss}
              style={styles.cancelButton}
              textColor={Colors.textSecondary}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={isLoading}
              disabled={isLoading}
              style={styles.submitButton}
              buttonColor={Colors.accent}
              textColor={Colors.white}
            >
              Check In
            </Button>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    margin: 20,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadowHeavy,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  emoji: {
    fontSize: 44,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter_800ExtraBold',
    color: Colors.text,
    marginBottom: 4,
    letterSpacing: -0.7,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  charCountRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
    minHeight: 20,
  },
  charCount: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textTertiary,
  },
  charCountValid: {
    color: Colors.success,
  },
  errorText: {
    color: Colors.error,
    fontFamily: 'Inter_500Medium',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    borderColor: Colors.border,
    borderRadius: 12,
  },
  submitButton: {
    borderRadius: 12,
  },
});
