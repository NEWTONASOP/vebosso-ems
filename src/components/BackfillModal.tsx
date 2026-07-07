// ============================================================================
// VEBOSSO EMS — Backfill Attendance Modal
// ============================================================================

import React, { useState, useEffect } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View, ScrollView } from 'react-native';
import { Button, HelperText, Modal, Portal, Text, TextInput } from 'react-native-paper';
import { Colors } from '../constants/colors';
import { format, parse } from 'date-fns';

interface BackfillModalProps {
  visible: boolean;
  date: string; // 'YYYY-MM-DD'
  onDismiss: () => void;
  onSubmit: (checkInTime: string, checkInPlan: string, checkOutTime: string, dayReport: string) => Promise<void>;
  isLoading?: boolean;
  initialCheckInPlan?: string;
  initialCheckInTime?: string; // ISO or HH:MM
  initialCheckOutTime?: string; // ISO or HH:MM
  initialDayReport?: string;
}

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
  const [inTime, setInTime] = useState('09:00');
  const [outTime, setOutTime] = useState('18:00');
  const [plan, setPlan] = useState('');
  const [report, setReport] = useState('');
  const [error, setError] = useState('');

  // Format Helper: Extract HH:MM from ISO string if needed
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

  useEffect(() => {
    if (visible) {
      setInTime(formatTimeToHHMM(initialCheckInTime) || '09:00');
      setOutTime(formatTimeToHHMM(initialCheckOutTime) || '18:00');
      setPlan(initialCheckInPlan);
      setReport(initialDayReport);
      setError('');
    }
  }, [visible, initialCheckInTime, initialCheckOutTime, initialCheckInPlan, initialDayReport]);

  const validateTime = (timeStr: string) => {
    return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeStr);
  };

  const handleSubmit = async () => {
    setError('');

    const trimmedIn = inTime.trim();
    const trimmedOut = outTime.trim();

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

    // Parse times to ensure check-out is after check-in
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

    // Construct full ISO timestamps combining the target backfill date and local selected times
    const checkInISO = new Date(`${date}T${trimmedIn}:00`).toISOString();
    const checkOutISO = new Date(`${date}T${trimmedOut}:00`).toISOString();

    await onSubmit(checkInISO, plan.trim(), checkOutISO, report.trim());
  };

  const formattedDateLabel = () => {
    try {
      return format(new Date(date + 'T00:00:00'), 'EEEE, MMMM dd, yyyy');
    } catch {
      return date;
    }
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.container}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Text style={styles.emoji}>📝</Text>
              <Text style={styles.title}>Backfill Attendance</Text>
              <Text style={styles.subtitle}>{formattedDateLabel()}</Text>
            </View>

            {error ? (
              <HelperText type="error" visible={!!error} style={styles.errorText}>
                {error}
              </HelperText>
            ) : null}

            <View style={styles.timeRow}>
              <TextInput
                mode="outlined"
                label="Check-in (HH:MM)"
                placeholder="09:00"
                value={inTime}
                onChangeText={(text) => {
                  setInTime(text);
                  setError('');
                }}
                maxLength={5}
                style={styles.timeInput}
                outlineColor={Colors.border}
                activeOutlineColor={Colors.accent}
                textColor={Colors.text}
              />
              <TextInput
                mode="outlined"
                label="Check-out (HH:MM)"
                placeholder="18:00"
                value={outTime}
                onChangeText={(text) => {
                  setOutTime(text);
                  setError('');
                }}
                maxLength={5}
                style={styles.timeInput}
                outlineColor={Colors.border}
                activeOutlineColor={Colors.accent}
                textColor={Colors.text}
              />
            </View>

            <TextInput
              mode="outlined"
              label="Check-in Plan"
              placeholder="What was your plan for the day?"
              value={plan}
              onChangeText={(text) => {
                setPlan(text);
                setError('');
              }}
              multiline
              numberOfLines={3}
              style={styles.input}
              outlineColor={Colors.border}
              activeOutlineColor={Colors.accent}
              textColor={Colors.text}
            />

            <TextInput
              mode="outlined"
              label="Day Report / Accomplishments"
              placeholder="Summarize what you accomplished..."
              value={report}
              onChangeText={(text) => {
                setReport(text);
                setError('');
              }}
              multiline
              numberOfLines={4}
              style={styles.input}
              outlineColor={Colors.border}
              activeOutlineColor={Colors.accent}
              textColor={Colors.text}
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
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  timeInput: {
    flex: 1,
    height: 50,
  },
  input: {
    marginBottom: 16,
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
