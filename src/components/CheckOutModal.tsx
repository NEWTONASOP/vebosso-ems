// ============================================================================
// VEBOSSO EMS — Check-Out Modal
// ============================================================================

import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Button, HelperText, Modal, Portal, Text, TextInput } from 'react-native-paper';
import { Colors } from '../constants/colors';

interface CheckOutModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (report: string) => Promise<void>;
  isLoading?: boolean;
}

export function CheckOutModal({ visible, onDismiss, onSubmit, isLoading }: CheckOutModalProps) {
  const [report, setReport] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    // Just check if not empty
    if (report.trim().length === 0) {
      setError('Please provide a day report');
      return;
    }
    
    // Sanitize input - remove excessive whitespace and limit length
    const sanitized = report.trim().slice(0, 1000); // Max 1000 chars
    
    setError('');
    await onSubmit(sanitized);
    setReport('');
  };

  const handleDismiss = () => {
    setReport('');
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
            <Text style={styles.emoji}>🌙</Text>
            <Text style={styles.title}>End Your Day</Text>
            <Text style={styles.subtitle}>
              Summarize what you accomplished today
            </Text>
          </View>

          <TextInput
            mode="outlined"
            label="Day Report"
            placeholder="Write a summary of your work today..."
            value={report}
            onChangeText={(text) => {
              setReport(text);
              if (error) setError('');
            }}
            multiline
            numberOfLines={5}
            maxLength={3000}
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

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4 }}>
            <Text style={{ fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textTertiary }}>
              {report.length} / 3000
            </Text>
          </View>

          {error ? (
            <HelperText type="error" visible={!!error} style={styles.errorText}>
              {error}
            </HelperText>
          ) : null}

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
              disabled={isLoading}
              style={styles.submitButton}
              buttonColor={Colors.accent}
              textColor={Colors.white}
            >
              End Day
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
    minHeight: 120,
    fontFamily: 'Inter_400Regular',
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
