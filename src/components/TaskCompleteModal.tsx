// ============================================================================
// VEBOSSO EMS — Task Completion Modal with Optional Note
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { Button, Modal, Portal, Text } from 'react-native-paper';
import { Colors } from '../constants/colors';

interface TaskCompleteModalProps {
  visible: boolean;
  taskTitle: string;
  onDismiss: () => void;
  onComplete: (note: string) => void;
}

export function TaskCompleteModal({
  visible,
  taskTitle,
  onDismiss,
  onComplete,
}: TaskCompleteModalProps) {
  const [note, setNote] = useState('');

  const handleSkip = () => {
    setNote('');
    onComplete('');
    onDismiss();
  };

  const handleSubmit = () => {
    onComplete(note.trim());
    setNote('');
    onDismiss();
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modalContainer}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <Feather name="check-circle" size={24} color={Colors.success} />
              </View>
              <Text style={styles.title}>Complete Task</Text>
            </View>

            {/* Task Title */}
            <View style={styles.taskTitleContainer}>
              <Text style={styles.taskTitle} numberOfLines={2}>
                {taskTitle}
              </Text>
            </View>

            {/* Input Section */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>What did you accomplish? (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Brief summary of your work..."
                placeholderTextColor={Colors.textTertiary}
                value={note}
                onChangeText={setNote}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={500}
              />
              <Text style={styles.charCounter}>{note.length}/500</Text>
            </View>

            {/* Buttons */}
            <View style={styles.buttonRow}>
              <Button
                mode="outlined"
                onPress={handleSkip}
                style={styles.skipButton}
                contentStyle={styles.buttonContent}
                textColor={Colors.textSecondary}
                labelStyle={styles.skipButtonText}
              >
                Skip
              </Button>

              <Button
                mode="contained"
                onPress={handleSubmit}
                style={styles.submitButton}
                contentStyle={styles.buttonContent}
                buttonColor={Colors.success}
                textColor={Colors.white}
                labelStyle={styles.submitButtonText}
              >
                {note.trim() ? 'Submit' : 'Mark Done'}
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    marginHorizontal: 20,
    justifyContent: 'center',
  },
  keyboardView: {
    width: '100%',
  },
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  taskTitleContainer: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  taskTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
    textAlign: 'center',
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  input: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.text,
    minHeight: 100,
    maxHeight: 150,
  },
  charCounter: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.textTertiary,
    textAlign: 'right',
    marginTop: 6,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  buttonContent: {
    height: 48,
  },
  skipButton: {
    flex: 1,
    borderRadius: 14,
    borderColor: Colors.border,
  },
  skipButtonText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: Colors.textSecondary,
    letterSpacing: -0.1,
  },
  submitButton: {
    flex: 1,
    borderRadius: 14,
  },
  submitButtonText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: Colors.white,
    letterSpacing: -0.1,
  },
});
