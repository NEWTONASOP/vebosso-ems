// ============================================================================
// VEBOSSO EMS — Assign Task Modal
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { addDays, format, isValid, parseISO } from 'date-fns';
import { useCallback, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Button, Chip, HelperText, Icon, Modal, Portal, Text } from 'react-native-paper';
import { AppTheme, appShadow, appSoftShadow } from '../constants/theme';
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

function getAvatarColors(role: Profile['role'] | undefined) {
  switch (role) {
    case 'owner':
      return { bg: AppTheme.coralSoft, text: AppTheme.coral };
    case 'manager':
      return { bg: AppTheme.blueSoft, text: AppTheme.blue };
    default:
      return { bg: AppTheme.greenSoft, text: AppTheme.green };
  }
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

  const avatarColors = getAvatarColors(targetMember?.role);

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
                <View style={styles.roleChip}>
                  <Text style={styles.memberRole}>{ROLE_LABELS[targetMember.role]}</Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Feather name="clipboard" size={22} color={AppTheme.charcoal} />
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
                selectedColor={AppTheme.white}
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
                selectedColor={AppTheme.white}
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
                selectedColor={AppTheme.white}
                mode={dueDate === null ? 'flat' : 'outlined'}
              >
                No Date
              </Chip>
            </View>

            {!showDateInput && (!dueDate || dueDate === today || dueDate === tomorrow) && (
              <Button
                mode="text"
                compact
                icon="calendar-plus"
                textColor={AppTheme.charcoal}
                onPress={() => setShowDateInput(true)}
                style={styles.customDateTrigger}
                labelStyle={styles.customDateTriggerLabel}
              >
                Or select custom date...
              </Button>
            )}

            {!showDateInput && dueDate && dueDate !== today && dueDate !== tomorrow && (
              <View style={styles.customDateDisplay}>
                <View style={styles.customDateBadge}>
                  <Icon source="calendar" size={16} color={AppTheme.charcoal} />
                  <Text style={styles.customDateText}>{formatDueDateDisplay(dueDate)}</Text>
                </View>
                <Button
                  compact
                  textColor={AppTheme.mute}
                  onPress={() => setShowDateInput(true)}
                  labelStyle={styles.changeDateLabel}
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
                  textColor={AppTheme.mute}
                  onPress={() => {
                    setShowDateInput(false);
                    dateInputRef.current = '';
                  }}
                  labelStyle={styles.changeDateLabel}
                >
                  Cancel
                </Button>
              </View>
            )}
          </View>

          {error && (
            <HelperText type="error" visible={!!error} style={styles.errorText}>
              {error}
            </HelperText>
          )}

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
    backgroundColor: AppTheme.card,
    margin: 20,
    borderRadius: 28,
    padding: 24,
    maxHeight: '85%',
    ...appShadow,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AppTheme.hairline,
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
    color: AppTheme.ink,
    marginBottom: 4,
  },
  roleChip: {
    alignSelf: 'flex-start',
    backgroundColor: AppTheme.soft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  memberRole: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: AppTheme.mute,
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
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
    color: AppTheme.ink,
    marginBottom: 4,
    letterSpacing: -0.7,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: AppTheme.mute,
    textAlign: 'center',
  },
  dueDateSection: {
    marginBottom: 16,
  },
  dueDateLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: AppTheme.ink,
    marginBottom: 10,
  },
  quickChipsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    flex: 1,
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
  customDateTrigger: {
    alignSelf: 'flex-start',
    marginTop: -4,
    marginBottom: 8,
  },
  customDateTriggerLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  customDateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: AppTheme.soft,
    borderRadius: 14,
  },
  customDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customDateText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: AppTheme.ink,
  },
  changeDateLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
  },
  dateInputContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  errorText: {
    color: AppTheme.coral,
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
    borderRadius: 24,
    ...appSoftShadow,
  },
  submitButton: {
    borderRadius: 24,
    ...appSoftShadow,
  },
});
