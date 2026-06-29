// ============================================================================
// VEBOSSO EMS — Check-In Modal
// ============================================================================

import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Button, HelperText, Modal, Portal, Text, TextInput } from 'react-native-paper';
import { Colors } from '../constants/colors';
import { MIN_CHECKIN_PLAN_LENGTH } from '../constants/roles';

interface CheckInModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (plan: string) => Promise<void>;
  isLoading?: boolean;
}

export function CheckInModal({ visible, onDismiss, onSubmit, isLoading }: CheckInModalProps) {
  const [plan, setPlan] = useState('');
  const [error, setError] = useState('');

  const charCount = plan.length;
  const isValid = charCount >= MIN_CHECKIN_PLAN_LENGTH;

  const handleSubmit = async () => {
    if (!isValid) {
      setError(`Plan must be at least ${MIN_CHECKIN_PLAN_LENGTH} characters`);
      return;
    }
    
    // Sanitize input - remove excessive whitespace and limit length
    const sanitized = plan.trim().slice(0, 1000); // Max 1000 chars
    
    setError('');
    await onSubmit(sanitized);
    setPlan('');
  };

  const handleDismiss = () => {
    setPlan('');
    setError('');
    onDismiss();
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={handleDismiss}
        contentContainerStyle={styles.container}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <Text style={styles.emoji}>🌅</Text>
            <Text style={styles.title}>Start Your Day</Text>
            <Text style={styles.subtitle}>
              What will you work on today?
            </Text>
          </View>

          <TextInput
            mode="outlined"
            label="Today's Plan"
            placeholder="Describe what you'll be working on today..."
            value={plan}
            onChangeText={(text) => {
              setPlan(text);
              if (error) setError('');
            }}
            multiline
            numberOfLines={4}
            style={styles.input}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.accent}
            textColor={Colors.text}
            placeholderTextColor={Colors.placeholder}
            theme={{
              colors: {
                onSurfaceVariant: Colors.textTertiary,
                surface: Colors.inputBackground,
              },
            }}
          />

          <View style={styles.charCountRow}>
            {error ? (
              <HelperText type="error" visible={!!error} style={styles.errorText}>
                {error}
              </HelperText>
            ) : (
              <Text style={[styles.charCount, isValid && styles.charCountValid]}>
                {charCount}/{MIN_CHECKIN_PLAN_LENGTH} characters
              </Text>
            )}
          </View>

          <View style={styles.actions}>
            <Button
              mode="outlined"
              onPress={handleDismiss}
              style={styles.cancelButton}
              textColor={Colors.textSecondary}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={isLoading}
              disabled={!isValid || isLoading}
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
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  emoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  input: {
    backgroundColor: Colors.inputBackground,
    minHeight: 100,
  },
  charCountRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
    minHeight: 20,
  },
  charCount: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  charCountValid: {
    color: Colors.success,
  },
  errorText: {
    color: Colors.error,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  cancelButton: {
    borderColor: Colors.border,
    borderRadius: 8,
  },
  submitButton: {
    borderRadius: 8,
  },
});
