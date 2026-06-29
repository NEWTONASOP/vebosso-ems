// ============================================================================
// VEBOSSO EMS — Check-Out Modal
// ============================================================================

import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Modal, Portal, Text, TextInput, Button, HelperText } from 'react-native-paper';
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
    if (report.trim().length < 10) {
      setError('Please provide a more detailed day report (at least 10 characters)');
      return;
    }
    setError('');
    await onSubmit(report);
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
            style={styles.input}
            outlineColor={Colors.borderLight}
            activeOutlineColor={Colors.accent}
            textColor={Colors.text}
            placeholderTextColor={Colors.placeholder}
            theme={{
              colors: {
                onSurfaceVariant: Colors.textSecondary,
                surface: Colors.inputBackground,
              },
            }}
          />

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
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
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
    minHeight: 120,
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
    borderColor: Colors.borderLight,
    borderRadius: 8,
  },
  submitButton: {
    borderRadius: 8,
  },
});
