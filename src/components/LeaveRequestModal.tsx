// ============================================================================
// VEBOSSO EMS — Leave Request Modal
// ============================================================================

import { addDays, format, isValid, parseISO } from 'date-fns';
import { useCallback, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { Button, Chip, HelperText, Modal, Portal, Text } from 'react-native-paper';
import { Colors } from '../constants/colors';

interface LeaveRequestModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (date: string, reason: string) => Promise<void>;
  isLoading?: boolean;
}

export function LeaveRequestModal({
  visible,
  onDismiss,
  onSubmit,
  isLoading,
}: LeaveRequestModalProps) {
  const dateRef = useRef('');
  const reasonRef = useRef('');
  const [dateStr, setDateStr] = useState('');
  const [charCount, setCharCount] = useState(0);
  const [error, setError] = useState('');

  const clearError = useCallback(() => {
    setError((prev) => (prev ? '' : prev));
  }, []);

  const today = format(new Date(), 'yyyy-MM-dd');
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const nextMonday = () => {
    const todayDate = new Date();
    const day = todayDate.getDay();
    const diff = todayDate.getDate() - day + (day === 0 ? 1 : 8); // next Monday
    return format(new Date(todayDate.setDate(diff)), 'yyyy-MM-dd');
  };

  const handleQuickDateSelect = (selectedDate: string) => {
    dateRef.current = selectedDate;
    setDateStr(selectedDate);
    setError('');
  };

  const handleDateChange = (text: string) => {
    const filtered = text.replace(/[^0-9-]/g, '');
    dateRef.current = filtered;
    setDateStr(filtered);
    setError('');

    // If text reaches 10 chars, validate YYYY-MM-DD
    if (filtered.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(filtered)) {
      const parsed = parseISO(filtered);
      if (!isValid(parsed)) {
        setError('Invalid date format');
      } else if (filtered < today) {
        setError('Leave date cannot be in the past');
      }
    }
  };

  const handleSubmit = async () => {
    const dateValue = dateRef.current;
    const reason = reasonRef.current;

    if (!dateValue.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      setError('Please enter date as YYYY-MM-DD');
      return;
    }
    const parsed = parseISO(dateValue);
    if (!isValid(parsed)) {
      setError('Invalid date format');
      return;
    }
    if (dateValue < today) {
      setError('Leave date cannot be in the past');
      return;
    }
    if (!reason.trim()) {
      setError('Please provide a reason for leave');
      return;
    }

    setError('');
    await onSubmit(dateValue, reason.trim().slice(0, 500));
    onDismiss();
  };

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
            <Text style={styles.emoji}>✈️</Text>
            <Text style={styles.title}>Request Leave</Text>
            <Text style={styles.subtitle}>
              Apply for leave approval from your manager/owner
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Select Date</Text>
            <View style={styles.chipsRow}>
              <Chip
                selected={dateStr === today}
                onPress={() => handleQuickDateSelect(today)}
                style={styles.chip}
                selectedColor={Colors.accent}
                showSelectedOverlay
              >
                Today
              </Chip>
              <Chip
                selected={dateStr === tomorrow}
                onPress={() => handleQuickDateSelect(tomorrow)}
                style={styles.chip}
                selectedColor={Colors.accent}
                showSelectedOverlay
              >
                Tomorrow
              </Chip>
              <Chip
                selected={dateStr === nextMonday()}
                onPress={() => handleQuickDateSelect(nextMonday())}
                style={styles.chip}
                selectedColor={Colors.accent}
                showSelectedOverlay
              >
                Next Mon
              </Chip>
            </View>

            <Text style={styles.inputLabel}>Leave Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 2026-07-15"
              placeholderTextColor={Colors.placeholder}
              value={dateStr}
              onChangeText={handleDateChange}
              maxLength={10}
              keyboardType="numbers-and-punctuation"
              editable={!isLoading}
            />
          </View>

          <View style={[styles.section, { marginTop: 12 }]}>
            <Text style={styles.label}>Reason for Leave</Text>
            <TextInput
              style={styles.input}
              placeholder="E.g. Family function / medical appointment..."
              placeholderTextColor={Colors.placeholder}
              defaultValue=""
              onChangeText={(text) => {
                reasonRef.current = text;
                setCharCount(text.length);
                clearError();
              }}
              multiline
              textAlignVertical="top"
              maxLength={500}
              editable={!isLoading}
              blurOnSubmit={false}
            />
            <View style={styles.charCountRow}>
              <Text style={styles.charCount}>{charCount} / 500</Text>
            </View>
          </View>

          {error ? (
            <HelperText type="error" visible={!!error} style={styles.errorText}>
              {error}
            </HelperText>
          ) : null}

          <View style={styles.actions}>
            <Button
              mode="outlined"
              onPress={onDismiss}
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
              Submit Request
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
    marginBottom: 16,
  },
  emoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter_800ExtraBold',
    color: Colors.text,
    marginBottom: 4,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  section: {
    width: '100%',
  },
  label: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  chip: {
    backgroundColor: Colors.surfaceLight,
    borderColor: Colors.border,
  },
  inputLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: Colors.text,
  },
  inputReason: {
    minHeight: 88,
    maxHeight: 160,
    paddingTop: 14,
  },
  charCountRow: {
    alignItems: 'flex-end',
    marginTop: 4,
  },
  charCount: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontFamily: 'Inter_500Medium',
  },
  errorText: {
    color: Colors.error,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  cancelButton: {
    borderColor: Colors.border,
    borderRadius: 12,
  },
  submitButton: {
    borderRadius: 12,
  },
});
