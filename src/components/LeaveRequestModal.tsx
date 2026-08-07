// ============================================================================
// VEBOSSO EMS — Leave Request Modal
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { addDays, format, isValid, parseISO } from 'date-fns';
import { useCallback, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Button, Chip, HelperText, Modal, Portal, Text } from 'react-native-paper';
import { AppTheme, AppRadius, appShadow, appSoftShadow } from '../constants/theme';
import { PaperOutlinedField } from './PaperOutlinedField';

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

  const monday = nextMonday();

  return (
    <Portal>
      <Modal
        visible
        onDismiss={onDismiss}
        contentContainerStyle={styles.container}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Feather name="send" size={22} color={AppTheme.charcoal} />
            </View>
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
                style={[
                  styles.chip,
                  dateStr === today ? styles.chipActive : styles.chipInactive,
                ]}
                textStyle={[
                  styles.chipText,
                  dateStr === today && styles.chipTextSelected,
                ]}
                selectedColor={AppTheme.white}
                mode={dateStr === today ? 'flat' : 'outlined'}
              >
                Today
              </Chip>
              <Chip
                selected={dateStr === tomorrow}
                onPress={() => handleQuickDateSelect(tomorrow)}
                style={[
                  styles.chip,
                  dateStr === tomorrow ? styles.chipActive : styles.chipInactive,
                ]}
                textStyle={[
                  styles.chipText,
                  dateStr === tomorrow && styles.chipTextSelected,
                ]}
                selectedColor={AppTheme.white}
                mode={dateStr === tomorrow ? 'flat' : 'outlined'}
              >
                Tomorrow
              </Chip>
              <Chip
                selected={dateStr === monday}
                onPress={() => handleQuickDateSelect(monday)}
                style={[
                  styles.chip,
                  dateStr === monday ? styles.chipActive : styles.chipInactive,
                ]}
                textStyle={[
                  styles.chipText,
                  dateStr === monday && styles.chipTextSelected,
                ]}
                selectedColor={AppTheme.white}
                mode={dateStr === monday ? 'flat' : 'outlined'}
              >
                Next Mon
              </Chip>
            </View>

            <PaperOutlinedField
              label="Leave Date (YYYY-MM-DD)"
              placeholder="e.g. 2026-07-15"
              value={dateStr}
              onChangeText={handleDateChange}
              maxLength={10}
              keyboardType="numbers-and-punctuation"
              editable={!isLoading}
              dense
            />
          </View>

          <View style={[styles.section, { marginTop: 12 }]}>
            <PaperOutlinedField
              label="Reason for Leave"
              placeholder="E.g. Family function / medical appointment..."
              defaultValue=""
              onChangeText={(text) => {
                reasonRef.current = text;
                setCharCount(text.length);
                clearError();
              }}
              multiline
              maxLength={500}
              editable={!isLoading}
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
              mode="contained"
              onPress={onDismiss}
              style={styles.cancelButton}
              buttonColor={AppTheme.soft2}
              textColor={AppTheme.inkSoft}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={isLoading}
              disabled={isLoading}
              style={styles.submitButton}
              buttonColor={AppTheme.charcoal}
              textColor={AppTheme.white}
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
    backgroundColor: AppTheme.card,
    margin: 20,
    borderRadius: AppRadius.sheet,
    padding: 24,
    ...appShadow,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: AppTheme.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    ...appSoftShadow,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: AppTheme.ink,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: AppTheme.mute,
    textAlign: 'center',
  },
  section: {
    width: '100%',
  },
  label: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: AppTheme.ink,
    marginBottom: 10,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  chip: {
    borderRadius: 14,
  },
  chipActive: {
    backgroundColor: AppTheme.charcoal,
    borderColor: AppTheme.charcoal,
  },
  chipInactive: {
    backgroundColor: AppTheme.soft,
    borderColor: AppTheme.soft2,
  },
  chipText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: AppTheme.inkSoft,
  },
  chipTextSelected: {
    color: AppTheme.white,
  },
  charCountRow: {
    alignItems: 'flex-end',
    marginTop: 4,
  },
  charCount: {
    fontSize: 12,
    color: AppTheme.mute,
    fontFamily: 'Inter_400Regular',
  },
  errorText: {
    color: AppTheme.coral,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    borderRadius: 24,
    ...appSoftShadow,
  },
  submitButton: {
    borderRadius: 24,
    ...appSoftShadow,
  },
});
