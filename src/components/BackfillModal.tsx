// ============================================================================
// VEBOSSO EMS — Backfill Attendance Modal
// ============================================================================

import { useCallback, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, Modal, Portal, Text } from 'react-native-paper';
import { Colors } from '../constants/colors';
import { format, parse } from 'date-fns';
import { PaperOutlinedField } from './PaperOutlinedField';

interface BackfillModalProps {
  visible: boolean;
  date: string;
  onDismiss: () => void;
  onSubmit: (checkInTime: string, checkInPlan: string, checkOutTime: string, dayReport: string) => Promise<void>;
  isLoading?: boolean;
  initialCheckInPlan?: string;
  initialCheckInTime?: string;
  initialCheckOutTime?: string;
  initialDayReport?: string;
}

const formatTimeToHHMM = (timeStr: string) => {
  if (!timeStr) return '';
  if (timeStr.includes('T')) {
    try {
      return format(new Date(timeStr), 'HH:mm');
    } catch {
      return '09:00';
    }
  }
  return timeStr;
};

export function BackfillModal({
  visible,
  date,
  onDismiss,
  onSubmit,
  isLoading,
  initialCheckInPlan = '',
  initialCheckInTime = '09:00',
  initialCheckOutTime = '18:00',
  initialDayReport = '',
}: BackfillModalProps) {
  const inTimeRef = useRef(formatTimeToHHMM(initialCheckInTime) || '09:00');
  const outTimeRef = useRef(formatTimeToHHMM(initialCheckOutTime) || '18:00');
  const planRef = useRef(initialCheckInPlan);
  const reportRef = useRef(initialDayReport);
  const [error, setError] = useState('');

  const clearError = useCallback(() => {
    setError((prev) => (prev ? '' : prev));
  }, []);

  const validateTime = (timeStr: string) => /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeStr);

  const handleSubmit = async () => {
    setError('');

    const trimmedIn = inTimeRef.current.trim();
    const trimmedOut = outTimeRef.current.trim();
    const plan = planRef.current;
    const report = reportRef.current;

    if (!validateTime(trimmedIn)) {
      setError('Check-in time must be in HH:MM format (24-hour)');
      return;
    }
    if (!validateTime(trimmedOut)) {
      setError('Check-out time must be in HH:MM format (24-hour)');
      return;
    }
    if (!plan.trim()) {
      setError('Please provide a check-in plan');
      return;
    }
    if (!report.trim()) {
      setError('Please provide a day report');
      return;
    }

    try {
      const inParsed = parse(trimmedIn, 'HH:mm', new Date());
      const outParsed = parse(trimmedOut, 'HH:mm', new Date());
      if (outParsed <= inParsed) {
        setError('Check-out time must be after check-in time');
        return;
      }
    } catch {
      setError('Failed to validate times');
      return;
    }

    const checkInISO = new Date(`${date}T${trimmedIn}:00`).toISOString();
    const checkOutISO = new Date(`${date}T${trimmedOut}:00`).toISOString();
    await onSubmit(checkInISO, plan.trim(), checkOutISO, report.trim());
  };

  if (!visible) return null;

  const defaultInTime = formatTimeToHHMM(initialCheckInTime) || '09:00';
  const defaultOutTime = formatTimeToHHMM(initialCheckOutTime) || '18:00';

  return (
    <Portal>
      <Modal visible onDismiss={onDismiss} contentContainerStyle={styles.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Text style={styles.emoji}>📝</Text>
              <Text style={styles.title}>Backfill Attendance</Text>
              <Text style={styles.subtitle}>
                {(() => {
                  try {
                    return format(new Date(date + 'T00:00:00'), 'EEEE, MMMM dd, yyyy');
                  } catch {
                    return date;
                  }
                })()}
              </Text>
            </View>

            {error ? (
              <HelperText type="error" visible={!!error} style={styles.errorText}>
                {error}
              </HelperText>
            ) : null}

            <View style={styles.timeRow}>
              <View style={styles.timeField}>
                <PaperOutlinedField
                  label="Check-in (HH:MM)"
                  placeholder="09:00"
                  defaultValue={defaultInTime}
                  onChangeText={(text) => {
                    inTimeRef.current = text;
                    clearError();
                  }}
                  maxLength={5}
                  keyboardType="numbers-and-punctuation"
                  editable={!isLoading}
                  dense
                />
              </View>
              <View style={styles.timeField}>
                <PaperOutlinedField
                  label="Check-out (HH:MM)"
                  placeholder="18:00"
                  defaultValue={defaultOutTime}
                  onChangeText={(text) => {
                    outTimeRef.current = text;
                    clearError();
                  }}
                  maxLength={5}
                  keyboardType="numbers-and-punctuation"
                  editable={!isLoading}
                  dense
                />
              </View>
            </View>

            <PaperOutlinedField
              label="Check-in Plan"
              placeholder="What was your plan for the day?"
              defaultValue={initialCheckInPlan}
              onChangeText={(text) => {
                planRef.current = text;
                clearError();
              }}
              multiline
              editable={!isLoading}
            />

            <PaperOutlinedField
              label="Day Report / Accomplishments"
              placeholder="Summarize what you accomplished..."
              defaultValue={initialDayReport}
              onChangeText={(text) => {
                reportRef.current = text;
                clearError();
              }}
              multiline
              editable={!isLoading}
            />

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
              >
                Submit Attendance
              </Button>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
    padding: 24,
    margin: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    maxHeight: '90%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  emoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    color: Colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  timeField: {
    flex: 1,
  },
  errorText: {
    color: Colors.error,
    textAlign: 'center',
    marginBottom: 12,
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    borderColor: Colors.border,
  },
  submitButton: {
    flex: 2,
  },
});
