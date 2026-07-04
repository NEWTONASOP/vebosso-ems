// ============================================================================
// VEBOSSO EMS — Check-In Modal
// ============================================================================

import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Button, HelperText, Modal, Portal, Text, TextInput } from 'react-native-paper';
import { Colors } from '../constants/colors';

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
  const isValid = plan.trim().length > 0; // Just check if not empty

  const handleSubmit = async () => {
    if (!isValid) {
      setError('Please enter your plan for today');
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
            maxLength={2000}
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
                {charCount} / 2000
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
  input: {
    backgroundColor: Colors.inputBackground,
    minHeight: 100,
    fontFamily: 'Inter_400Regular',
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
