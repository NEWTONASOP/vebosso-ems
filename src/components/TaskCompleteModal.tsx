// ============================================================================
// VEBOSSO EMS — Task Completion Modal with Optional Note
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PaperOutlinedField } from './PaperOutlinedField';
import { Button, Modal, Portal, Text } from 'react-native-paper';
import { AppTheme, AppRadius, appShadow, appSoftShadow } from '../constants/theme';
import { useKeyboardHeight } from '../lib/useKeyboardHeight';

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
  // Same box and same handling as the check-in plan: the text lives in the
  // box, kept here only for submit and the counter.
  const noteRef = useRef('');
  const [count, setCount] = useState(0);
  // A fresh, empty box each time the dialog opens.
  const [fieldKey, setFieldKey] = useState(0);

  useEffect(() => {
    if (!visible) return;
    noteRef.current = '';
    setCount(0);
    setFieldKey((k) => k + 1);
  }, [visible]);

  // Centre the dialog in the space above the keyboard.
  const keyboard = useKeyboardHeight();

  const handleCancel = () => {
    onDismiss();
  };

  const handleSubmit = () => {
    onComplete(noteRef.current.trim());
    onDismiss();
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[styles.modalContainer, keyboard > 0 && { marginBottom: keyboard }]}
      >
        <View style={styles.keyboardView}>
          <View style={styles.container}>
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <Feather name="check-circle" size={22} color={AppTheme.green} />
              </View>
              <Text style={styles.title}>Complete Task</Text>
            </View>

            <View style={styles.taskTitleContainer}>
              <Text style={styles.taskTitle} numberOfLines={2}>
                {taskTitle}
              </Text>
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Add a note (optional). Whoever gave you this task will approve it or send it back.</Text>
              {/* The same box as the check-in plan. */}
              <PaperOutlinedField
                key={fieldKey}
                label="Note"
                placeholder="Brief summary of your work..."
                defaultValue=""
                onChangeText={(text) => {
                  noteRef.current = text;
                  setCount(text.length);
                }}
                multiline
                maxLength={500}
              />
              <Text style={styles.charCounter}>{count}/500</Text>
            </View>

            <View style={styles.buttonRow}>
              <Button
                mode="contained"
                onPress={handleCancel}
                style={styles.skipButton}
                contentStyle={styles.buttonContent}
                buttonColor={AppTheme.soft2}
                textColor={AppTheme.inkSoft}
                labelStyle={styles.skipButtonText}
              >
                Cancel
              </Button>

              <Button
                mode="contained"
                onPress={handleSubmit}
                style={styles.submitButton}
                contentStyle={styles.buttonContent}
                buttonColor={AppTheme.charcoal}
                textColor={AppTheme.white}
                labelStyle={styles.submitButtonText}
              >
                Send for approval
              </Button>
            </View>
          </View>
        </View>
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
    backgroundColor: AppTheme.card,
    borderRadius: AppRadius.sheet,
    padding: 24,
    ...appShadow,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: AppTheme.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    ...appSoftShadow,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    color: AppTheme.ink,
    letterSpacing: -0.5,
  },
  taskTitleContainer: {
    backgroundColor: AppTheme.soft,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  taskTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: AppTheme.ink,
    lineHeight: 20,
    textAlign: 'center',
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: AppTheme.inkSoft,
    marginBottom: 10,
  },
  input: {
    backgroundColor: AppTheme.soft,
    borderRadius: 14,
    padding: 14,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: AppTheme.ink,
    minHeight: 100,
    maxHeight: 150,
  },
  charCounter: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: AppTheme.mute,
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
    borderRadius: 24,
    ...appSoftShadow,
  },
  skipButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    letterSpacing: -0.1,
  },
  submitButton: {
    flex: 1,
    borderRadius: 24,
    ...appSoftShadow,
  },
  submitButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    letterSpacing: -0.1,
  },
});
