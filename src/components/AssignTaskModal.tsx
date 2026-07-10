// ============================================================================
// VEBOSSO EMS — Assign Task Modal
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { addDays, format, isValid, parseISO } from 'date-fns';
import { useCallback, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Button, Chip, HelperText, Icon, Modal, Portal, Text } from 'react-native-paper';
import { Colors } from '../constants/colors';
import { ROLE_LABELS } from '../constants/roles';
import { Profile } from '../types/database';
import { PaperOutlinedField } from './PaperOutlinedField';

interface AssignTaskModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (title: string, description: string | null, dueDate: string | null) => Promise<void>;
  targetMember: Profile | null;
  isLoading?: boolean;
}

export function AssignTaskModal({
  visible,
  onDismiss,
  onSubmit,
  targetMember,
  isLoading,
}: AssignTaskModalProps) {
  const titleRef = useRef('');
  const descriptionRef = useRef('');
  const dateInputRef = useRef('');
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [showDateInput, setShowDateInput] = useState(false);
  const [error, setError] = useState('');

  const clearError = useCallback(() => {
    setError((prev) => (prev ? '' : prev));
  }, []);

  const handleQuickDateSelect = (days: number | null) => {
    if (days === null) {
      setDueDate(null);
    } else {
      const date = addDays(new Date(), days);
      setDueDate(format(date, 'yyyy-MM-dd'));
    }
    setShowDateInput(false);
    dateInputRef.current = '';
  };

  const handleDateInputChange = (text: string) => {
    dateInputRef.current = text;
    setError('');

    if (text.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(text)) {
      const parsed = parseISO(text);
      if (isValid(parsed)) {
        setDueDate(text);
      } else {
        setError('Invalid date format');
      }
    }
  };

  const handleSubmit = async () => {
    const title = titleRef.current;
    const description = descriptionRef.current;

    if (!title.trim()) {
      setError('Task title is required');
      return;
    }

    setError('');
    try {
      const sanitizedTitle = title.trim().slice(0, 500);
      const sanitizedDescription = description.trim().length > 0 ? description.trim().slice(0, 2000) : null;
      await onSubmit(sanitizedTitle, sanitizedDescription, dueDate);
      onDismiss();
    } catch {
      setError('Failed to assign task');
    }
  };

  if (!visible) return null;

  const today = format(new Date(), 'yyyy-MM-dd');
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  const getAvatarColors = () => {
    if (!targetMember) return { bg: Colors.accent + '15', text: Colors.accent };
    switch (targetMember.role) {
      case 'owner': return { bg: '#FF6B6B15', text: '#FF6B6B' };
      case 'manager': return { bg: '#4ECDC415', text: '#4ECDC4' };
      case 'member': default: return { bg: '#95E1D315', text: '#95E1D3' };
    }
  };

  const formatDueDateDisplay = (date: string | null) => {
    if (!date) return 'No due date';
    if (date === today) return 'Today';
    if (date === tomorrow) return 'Tomorrow';
    try {
      return format(parseISO(date), 'MMM dd, yyyy');
    } catch {
      return date;
    }
  };

  const avatarColors = getAvatarColors();

  return (
    <Portal>
      <Modal
        visible
        onDismiss={onDismiss}
        contentContainerStyle={styles.container}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
          {/* Member Info Header */}
          {targetMember && (
            <View style={styles.memberHeader}>
              <Avatar.Text
                size={40}
                label={targetMember.full_name.substring(0, 2).toUpperCase()}
                style={[styles.avatar, { backgroundColor: avatarColors.bg }]}
                labelStyle={[styles.avatarLabel, { color: avatarColors.text }]}
              />
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{targetMember.full_name}</Text>
                <Text style={styles.memberRole}>{ROLE_LABELS[targetMember.role]}</Text>
              </View>
            </View>
          )}

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Feather name="clipboard" size={24} color={Colors.accent} />
            </View>
            <Text style={styles.title}>Assign Task</Text>
            <Text style={styles.subtitle}>
              Create a new task for{' '}
              {targetMember?.full_name.split(' ')[0] || 'team member'}
            </Text>
          </View>

          <PaperOutlinedField
            label="Task Title"
            placeholder="What needs to be done?"
            defaultValue=""
            onChangeText={(text) => {
              titleRef.current = text;
              if (error === 'Task title is required') clearError();
            }}
            editable={!isLoading}
          />

          <PaperOutlinedField
            label="Description (Optional)"
            placeholder="Add more details about this task..."
            defaultValue=""
            onChangeText={(text) => {
              descriptionRef.current = text;
            }}
            multiline
            editable={!isLoading}
          />

          {/* Due Date Section */}
          <View style={styles.dueDateSection}>
            <Text style={styles.dueDateLabel}>Due Date</Text>
            <View style={styles.quickChipsContainer}>
              <Chip
                selected={dueDate === today}
                onPress={() => handleQuickDateSelect(0)}
                style={[
                  styles.chip,
                  dueDate === today ? styles.chipActive : styles.chipInactive,
                ]}
                textStyle={[
                  styles.chipText,
                  dueDate === today && styles.chipTextSelected,
                ]}
                selectedColor={Colors.white}
                mode={dueDate === today ? 'flat' : 'outlined'}
              >
                Today
              </Chip>
              <Chip
                selected={dueDate === tomorrow}
                onPress={() => handleQuickDateSelect(1)}
                style={[
                  styles.chip,
                  dueDate === tomorrow ? styles.chipActive : styles.chipInactive,
                ]}
                textStyle={[
                  styles.chipText,
                  dueDate === tomorrow && styles.chipTextSelected,
                ]}
                selectedColor={Colors.white}
                mode={dueDate === tomorrow ? 'flat' : 'outlined'}
              >
                Tomorrow
              </Chip>
              <Chip
                selected={dueDate === null}
                onPress={() => handleQuickDateSelect(null)}
                style={[
                  styles.chip,
                  dueDate === null ? styles.chipActive : styles.chipInactive,
                ]}
                textStyle={[
                  styles.chipText,
                  dueDate === null && styles.chipTextSelected,
                ]}
                selectedColor={Colors.white}
                mode={dueDate === null ? 'flat' : 'outlined'}
              >
                No Date
              </Chip>
            </View>

            {/* Custom Date Trigger Button */}
            {!showDateInput && (!dueDate || dueDate === today || dueDate === tomorrow) && (
              <Button
                mode="text"
                compact
                icon="calendar-plus"
                textColor={Colors.accent}
                onPress={() => setShowDateInput(true)}
                style={styles.customDateTrigger}
              >
                Or select custom date...
              </Button>
            )}

            {/* Custom Date Input */}
            {!showDateInput && dueDate && dueDate !== today && dueDate !== tomorrow && (
              <View style={styles.customDateDisplay}>
                <View style={styles.customDateBadge}>
                  <Icon source="calendar" size={16} color={Colors.accent} />
                  <Text style={styles.customDateText}>{formatDueDateDisplay(dueDate)}</Text>
                </View>
                <Button
                  compact
                  textColor={Colors.textSecondary}
                  onPress={() => setShowDateInput(true)}
                >
                  Change
                </Button>
              </View>
            )}

            {showDateInput && (
              <View style={styles.dateInputContainer}>
                <View style={{ flex: 1 }}>
                  <PaperOutlinedField
                    label="Custom Date (YYYY-MM-DD)"
                    placeholder="2024-01-20"
                    defaultValue=""
                    onChangeText={handleDateInputChange}
                    keyboardType="numbers-and-punctuation"
                    editable={!isLoading}
                    dense
                  />
                </View>
                <Button
                  compact
                  textColor={Colors.textSecondary}
                  onPress={() => {
                    setShowDateInput(false);
                    dateInputRef.current = '';
                  }}
                >
                  Cancel
                </Button>
              </View>
            )}
          </View>

          {/* Error Message */}
          {error && (
            <HelperText type="error" visible={!!error} style={styles.errorText}>
              {error}
            </HelperText>
          )}

          {/* Action Buttons */}
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
              Assign Task
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
    backgroundColor: Colors.surface,
    margin: 20,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    maxHeight: '85%',
    ...Colors.shadowHeavy,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatar: {
    marginRight: 12,
  },
  avatarLabel: {
    fontFamily: 'Inter_600SemiBold',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    marginBottom: 2,
  },
  memberRole: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
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
  fieldLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  dueDateSection: {
    marginBottom: 16,
  },
  dueDateLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    marginBottom: 10,
  },
  quickChipsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    flex: 1,
    borderRadius: 12,
  },
  chipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  chipInactive: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  chipText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.accent,
  },
  chipTextSelected: {
    color: Colors.white,
  },
  customDateTrigger: {
    alignSelf: 'flex-start',
    marginTop: -4,
    marginBottom: 8,
  },
  customDateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  customDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customDateText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.text,
  },
  dateInputContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  errorText: {
    color: Colors.error,
    fontFamily: 'Inter_500Medium',
    marginBottom: 12,
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
