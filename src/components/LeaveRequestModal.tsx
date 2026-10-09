// ============================================================================
// VEBOSSO EMS — Leave Request Modal
// One day, or "from … till …" for several days in one request (055).
// ============================================================================

import { leaveLabel } from '../lib/leaveDates';
import { Feather } from '@expo/vector-icons';
import { addDays, differenceInCalendarDays, format, isValid, parseISO } from 'date-fns';
import { useCallback, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Button, HelperText, Modal, Portal, Text } from 'react-native-paper';
import { AppTheme, AppRadius, appShadow, appSoftShadow } from '../constants/theme';
import { DateField } from './DateTimeFields';
import { PaperOutlinedField } from './PaperOutlinedField';
import { FieldChainScope } from './FieldChain';
import { useDialogLift } from '../lib/useKeyboardHeight';

interface LeaveRequestModalProps {
  visible: boolean;
  onDismiss: () => void;
  /** `endDate`: the last day when it's more than one day. */
  onSubmit: (date: string, reason: string, endDate?: string | null) => Promise<void>;
  isLoading?: boolean;
}

export function LeaveRequestModal({
  visible,
  onDismiss,
  onSubmit,
  isLoading,
}: LeaveRequestModalProps) {
  // Above the keyboard on Android too (KeyboardAvoidingView only works on iOS here).
  const lifted = useDialogLift();
  const dateRef = useRef('');
  const reasonRef = useRef('');
  const [dateStr, setDateStr] = useState('');
  // Several days: the last day (null = just the one day).
  const [multi, setMulti] = useState(false);
  const [endStr, setEndStr] = useState<string | null>(null);
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


  const handleSubmit = async () => {
    const dateValue = dateRef.current;
    const reason = reasonRef.current;

    if (!dateValue.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      setError('Pick the leave date');
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
    const end = multi ? endStr : null;
    if (multi && !end) {
      setError('Pick the last day of your leave');
      return;
    }
    if (end && end < dateValue) {
      setError('The last day can’t be before the first');
      return;
    }
    if (end && differenceInCalendarDays(parseISO(end), parsed) > 59) {
      setError('Up to 60 days in one request');
      return;
    }
    if (!reason.trim()) {
      setError('Please provide a reason for leave');
      return;
    }

    setError('');
    await onSubmit(dateValue, reason.trim().slice(0, 500), end && end > dateValue ? end : null);
    onDismiss();
  };

  if (!visible) return null;

  const monday = nextMonday();

  return (
    <Portal>
      <Modal
        visible
        onDismiss={onDismiss}
        contentContainerStyle={[styles.container, lifted]}
      >
        <FieldChainScope>
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
            <View style={styles.modeRow}>
              {([false, true] as const).map((m) => (
                <Pressable
                  key={String(m)}
                  onPress={() => {
                    setMulti(m);
                    setError('');
                  }}
                  style={[styles.modeChip, multi === m && styles.modeChipOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: multi === m }}
                >
                  <Text style={[styles.modeText, multi === m && styles.modeTextOn]}>{m ? 'Several days' : 'One day'}</Text>
                </Pressable>
              ))}
            </View>
            <DateField
              label={multi ? 'From' : 'Leave date'}
              value={dateStr || null}
              onChange={handleQuickDateSelect}
              quick={[
                { label: 'Today', value: today },
                { label: 'Tomorrow', value: tomorrow },
                { label: 'Next Mon', value: monday },
              ]}
              allow="future"
              disabled={isLoading}
            />
            {multi ? (
              <DateField
                label="Till (last day of leave)"
                value={endStr}
                onChange={(d) => {
                  setEndStr(d);
                  setError('');
                }}
                allow="future"
                disabled={isLoading}
              />
            ) : null}
            {multi && dateStr && endStr && endStr >= dateStr ? (
              <Text style={styles.rangeNote}>{leaveLabel({ date: dateStr, end_date: endStr }, 'EEE, d MMM')}</Text>
            ) : null}
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
        </FieldChainScope>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  modeChip: { flex: 1, height: 38, borderRadius: 999, backgroundColor: AppTheme.soft, alignItems: 'center', justifyContent: 'center' },
  modeChipOn: { backgroundColor: AppTheme.charcoal },
  modeText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: AppTheme.inkSoft },
  modeTextOn: { color: AppTheme.white },
  rangeNote: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: AppTheme.ink, marginTop: 2 },
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
