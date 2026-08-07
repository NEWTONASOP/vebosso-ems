// ============================================================================
// VEBOSSO EMS — Task Detail Modal (Owner/Manager View)
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Divider, Modal, Portal, Text } from 'react-native-paper';
import { AppTheme, appSoftShadow } from '../constants/theme';
import { TaskStatus } from '../types/database';
import { AnimatedPressable } from './AnimatedPressable';

interface TaskDetailModalProps {
  visible: boolean;
  onDismiss: () => void;
  task: {
    id: string;
    title: string;
    description: string | null;
    status: TaskStatus;
    due_date: string | null;
    completion_note: string | null;
    completed_at: string | null;
    created_at: string;
    assignee: {
      id: string;
      full_name: string;
      employee_id: string;
      avatar_url: string | null;
      role: string;
    };
    assigned_by_profile?: {
      full_name: string;
      employee_id: string;
    };
  } | null;
  onReassign?: () => void;
}

export function TaskDetailModal({
  visible,
  onDismiss,
  task,
  onReassign,
}: TaskDetailModalProps) {
  if (!task) return null;

  const getStatusConfig = (status: TaskStatus) => {
    switch (status) {
      case 'done':
        return {
          icon: 'check-circle',
          color: AppTheme.green,
          bgColor: AppTheme.greenSoft,
          label: 'Completed',
        };
      case 'in_progress':
        return {
          icon: 'play-circle',
          color: AppTheme.blue,
          bgColor: AppTheme.blueSoft,
          label: 'In Progress',
        };
      default:
        return {
          icon: 'clock',
          color: AppTheme.mute,
          bgColor: AppTheme.soft,
          label: 'Pending',
        };
    }
  };

  const statusConfig = getStatusConfig(task.status);

  const getFormattedDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      return format(new Date(dateStr), 'EEEE, MMMM dd, yyyy');
    } catch {
      return dateStr;
    }
  };

  const getFormattedDateTime = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      return format(new Date(dateStr), 'MMM dd, yyyy · hh:mm a');
    } catch {
      return dateStr;
    }
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.container}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.statusIconContainer, { backgroundColor: statusConfig.bgColor }]}>
              <Feather name={statusConfig.icon as any} size={24} color={statusConfig.color} />
            </View>
            <AnimatedPressable
              scaleTo={0.9}
              style={styles.closeButton}
              onPress={onDismiss}
            >
              <Feather name="x" size={22} color={AppTheme.mute} />
            </AnimatedPressable>
          </View>

          {/* Status Badge */}
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
            <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>

          {/* Task Title */}
          <Text style={styles.title}>{task.title}</Text>

          {/* Description */}
          {task.description && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Feather name="file-text" size={16} color={AppTheme.mute} />
                <Text style={styles.sectionLabel}>Description</Text>
              </View>
              <Text style={styles.descriptionText}>{task.description}</Text>
            </View>
          )}

          <Divider style={styles.divider} />

          {/* Assignee Info */}
          {task.assignee && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Feather name="user" size={16} color={AppTheme.mute} />
                <Text style={styles.sectionLabel}>Assigned To</Text>
              </View>
              <View style={styles.assigneeRow}>
                <Avatar.Text
                  size={36}
                  label={task.assignee.full_name?.substring(0, 2).toUpperCase() || '??'}
                  style={styles.avatar}
                  labelStyle={styles.avatarLabel}
                />
                <View style={styles.assigneeInfo}>
                  <Text style={styles.assigneeName}>{task.assignee.full_name}</Text>
                  <Text style={styles.assigneeId}>ID: {task.assignee.employee_id}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Assigner Info */}
          {task.assigned_by_profile && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Feather name="user-check" size={16} color={AppTheme.mute} />
                <Text style={styles.sectionLabel}>Assigned By</Text>
              </View>
              <View style={styles.assigneeRow}>
                <Avatar.Text
                  size={36}
                  label={task.assigned_by_profile.full_name?.substring(0, 2).toUpperCase() || '??'}
                  style={styles.avatar}
                  labelStyle={styles.avatarLabel}
                />
                <View style={styles.assigneeInfo}>
                  <Text style={styles.assigneeName}>{task.assigned_by_profile.full_name}</Text>
                  <Text style={styles.assigneeId}>ID: {task.assigned_by_profile.employee_id}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Due Date */}
          {task.due_date && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Feather name="calendar" size={16} color={AppTheme.mute} />
                <Text style={styles.sectionLabel}>Due Date</Text>
              </View>
              <Text style={styles.infoText}>{getFormattedDate(task.due_date)}</Text>
            </View>
          )}

          {/* Completion Note */}
          {task.status === 'done' && task.completion_note && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Feather name="edit-3" size={16} color={AppTheme.green} />
                <Text style={[styles.sectionLabel, { color: AppTheme.green }]}>
                  Completion Note
                </Text>
              </View>
              <View style={styles.completionNoteBox}>
                <Text style={styles.completionNoteText}>{task.completion_note}</Text>
              </View>
            </View>
          )}

          {/* Completed At */}
          {task.status === 'done' && task.completed_at && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Feather name="check" size={16} color={AppTheme.mute} />
                <Text style={styles.sectionLabel}>Completed At</Text>
              </View>
              <Text style={styles.infoText}>{getFormattedDateTime(task.completed_at)}</Text>
            </View>
          )}

          {/* Created At */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="clock" size={16} color={AppTheme.mute} />
              <Text style={styles.sectionLabel}>Created</Text>
            </View>
            <Text style={styles.infoText}>{getFormattedDateTime(task.created_at)}</Text>
          </View>

          {/* Reassign Button - only show for non-done tasks */}
          {task.status !== 'done' && onReassign && (
            <>
              <Divider style={styles.divider} />
              <AnimatedPressable
                scaleTo={0.96}
                style={styles.reassignButton}
                onPress={() => {
                  onDismiss();
                  onReassign();
                }}
              >
                <Feather name="users" size={18} color={AppTheme.white} />
                <Text style={styles.reassignButtonText}>Reassign Task</Text>
              </AnimatedPressable>
            </>
          )}
        </ScrollView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: AppTheme.card,
    margin: 20,
    borderRadius: 24,
    padding: 24,
    maxHeight: '85%',
    ...appSoftShadow,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AppTheme.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 16,
  },
  statusBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    color: AppTheme.ink,
    lineHeight: 28,
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  divider: {
    backgroundColor: AppTheme.hairline,
    marginVertical: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: AppTheme.mute,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  descriptionText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: AppTheme.inkSoft,
    lineHeight: 22,
  },
  assigneeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    backgroundColor: AppTheme.soft,
  },
  avatarLabel: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: AppTheme.inkSoft,
  },
  assigneeInfo: {
    flex: 1,
  },
  assigneeName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: AppTheme.ink,
  },
  assigneeId: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: AppTheme.mute,
    marginTop: 2,
  },
  infoText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: AppTheme.ink,
  },
  completionNoteBox: {
    backgroundColor: AppTheme.greenSoft,
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: AppTheme.green,
  },
  completionNoteText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: AppTheme.inkSoft,
    lineHeight: 22,
  },
  reassignButton: {
    backgroundColor: AppTheme.charcoal,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    ...appSoftShadow,
  },
  reassignButtonText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    color: AppTheme.white,
    letterSpacing: -0.2,
  },
});
