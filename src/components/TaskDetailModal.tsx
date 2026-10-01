// ============================================================================
// VEBOSSO EMS — Task Detail Modal (Owner/Manager View)
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { VoiceNote } from './VoiceNote';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Divider, Modal, Portal, Text } from 'react-native-paper';
import { AppTheme, appSoftShadow } from '../constants/theme';
import { TaskStatus } from '../types/database';
import { AnimatedPressable } from './AnimatedPressable';
import { UserAvatar } from './UserAvatar';

/** What the owner or manager can do with a task. Each returns an error message, or null on success. */
export interface TaskManage {
  onSave: (changes: { title: string; description: string | null; due_date: string | null }) => Promise<string | null>;
  onApprove: () => Promise<string | null>;
  onReject: (reason: string) => Promise<string | null>;
}

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
    voice_path?: string | null;
    voice_ms?: number | null;
    rejection_reason?: string | null;
    /** Left out where the person is already obvious, e.g. inside their own task list. */
    assignee?: {
      id: string;
      full_name: string;
      employee_id: string;
      avatar_url: string | null;
      role: string;
    };
    assigned_by_profile?: {
      full_name: string;
      employee_id: string;
      avatar_url?: string | null;
    };
  } | null;
  onReassign?: () => void;
  /** Owner / manager only: edit the task, approve or reject finished work. */
  manage?: TaskManage;
}

export function TaskDetailModal({
  visible,
  onDismiss,
  task,
  onReassign,
  manage,
}: TaskDetailModalProps) {
  const [mode, setMode] = useState<'view' | 'edit' | 'reject'>('view');
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Always opens to the plain view, whichever task it is.
  useEffect(() => {
    setMode('view');
    setError('');
    setReason('');
  }, [task?.id, visible]);

  if (!task) return null;

  const startEdit = () => {
    setTitle(task.title);
    setError('');
    setMode('edit');
  };

  /** Runs an action that reports an error message; closes on success. */
  const run = async (action: () => Promise<string | null>) => {
    setBusy(true);
    setError('');
    const message = await action();
    setBusy(false);
    if (message) return setError(message);
    onDismiss();
  };

  const getStatusConfig = (status: TaskStatus) => {
    switch (status) {
      case 'done':
        return {
          icon: 'check-circle',
          color: AppTheme.green,
          bgColor: AppTheme.greenSoft,
          label: 'Completed',
        };
      case 'review':
        return {
          icon: 'eye',
          color: AppTheme.violet,
          bgColor: AppTheme.violetSoft,
          label: 'Awaiting approval',
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
          {mode !== 'edit' ? (
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
              <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
          ) : null}

          {mode === 'edit' ? (
            <View style={styles.section}>
              <Text style={styles.fieldLabel}>Task</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                style={[styles.input, styles.inputMulti]}
                multiline
                maxLength={2000}
                placeholder="What needs doing"
                placeholderTextColor={AppTheme.mute}
              />
            </View>
          ) : (
            <Text style={styles.title}>{task.title}</Text>
          )}

          {/* Editing shows only the message; everything else is for reading. */}
          {mode !== 'edit' ? (
          <>
          {/* Why it was sent back */}
          {task.rejection_reason && task.status !== 'done' ? (
            <View style={styles.rejectBox}>
              <View style={styles.sectionHeader}>
                <Feather name="corner-up-left" size={16} color={AppTheme.coral} />
                <Text style={[styles.sectionLabel, { color: AppTheme.coral }]}>
                  {task.status === 'review' ? 'Earlier rejection' : 'Rejected — do it again'}
                </Text>
              </View>
              <Text style={styles.rejectText}>{task.rejection_reason}</Text>
            </View>
          ) : null}

          {/* Voice note from whoever gave the task */}
          {task.voice_path ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Feather name="mic" size={16} color={AppTheme.mute} />
                <Text style={styles.sectionLabel}>Voice note</Text>
              </View>
              <VoiceNote path={task.voice_path} durationMs={task.voice_ms} />
            </View>
          ) : null}

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
                <UserAvatar
                  uri={task.assignee.avatar_url}
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
                <UserAvatar
                  uri={task.assigned_by_profile.avatar_url}
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
          {(task.status === 'done' || task.status === 'review') && task.completion_note && (
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
          {(task.status === 'done' || task.status === 'review') && task.completed_at && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Feather name="check" size={16} color={AppTheme.mute} />
                <Text style={styles.sectionLabel}>{task.status === 'review' ? 'Finished At' : 'Completed At'}</Text>
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
          </>
          ) : null}

          {/* Owner / manager: approve or reject finished work, edit the task */}
          {manage ? (
            <>
              <Divider style={styles.divider} />
              {error ? <Text style={styles.error}>{error}</Text> : null}

              {mode === 'reject' ? (
                <View>
                  <Text style={styles.fieldLabel}>Why is it rejected?</Text>
                  <TextInput
                    value={reason}
                    onChangeText={(t) => {
                      setReason(t);
                      if (error) setError('');
                    }}
                    style={[styles.input, styles.inputMulti]}
                    multiline
                    maxLength={1000}
                    autoFocus
                    placeholder="What needs to be redone"
                    placeholderTextColor={AppTheme.mute}
                  />
                  <View style={styles.btnRow}>
                    <AnimatedPressable scaleTo={0.96} style={[styles.btn, styles.btnSoft]} onPress={() => setMode('view')} disabled={busy}>
                      <Text style={styles.btnSoftText}>Back</Text>
                    </AnimatedPressable>
                    <AnimatedPressable
                      scaleTo={0.96}
                      style={[styles.btn, styles.btnReject]}
                      onPress={() => run(() => manage.onReject(reason))}
                      disabled={busy || !reason.trim()}
                    >
                      {busy ? <ActivityIndicator color={AppTheme.white} size="small" /> : <Text style={styles.btnDarkText}>Reject task</Text>}
                    </AnimatedPressable>
                  </View>
                </View>
              ) : mode === 'edit' ? (
                <View style={styles.btnRow}>
                  <AnimatedPressable scaleTo={0.96} style={[styles.btn, styles.btnSoft]} onPress={() => setMode('view')} disabled={busy}>
                    <Text style={styles.btnSoftText}>Cancel</Text>
                  </AnimatedPressable>
                  <AnimatedPressable
                    scaleTo={0.96}
                    style={[styles.btn, styles.btnDark]}
                    onPress={() => run(() => manage.onSave({ title, description: task.description, due_date: task.due_date }))}
                    disabled={busy || !title.trim()}
                  >
                    {busy ? <ActivityIndicator color={AppTheme.white} size="small" /> : <Text style={styles.btnDarkText}>Save changes</Text>}
                  </AnimatedPressable>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  {task.status === 'review' ? (
                    <View style={styles.btnRow}>
                      <AnimatedPressable scaleTo={0.96} style={[styles.btn, styles.btnRejectSoft]} onPress={() => { setError(''); setMode('reject'); }} disabled={busy}>
                        <Text style={styles.btnRejectSoftText}>Reject</Text>
                      </AnimatedPressable>
                      <AnimatedPressable scaleTo={0.96} style={[styles.btn, styles.btnApprove]} onPress={() => run(manage.onApprove)} disabled={busy}>
                        {busy ? <ActivityIndicator color={AppTheme.white} size="small" /> : <Text style={styles.btnDarkText}>Approve</Text>}
                      </AnimatedPressable>
                    </View>
                  ) : null}
                  <AnimatedPressable scaleTo={0.96} style={[styles.btn, styles.btnSoft]} onPress={startEdit} disabled={busy}>
                    <Feather name="edit-2" size={16} color={AppTheme.ink} />
                    <Text style={styles.btnSoftText}>Edit task</Text>
                  </AnimatedPressable>
                </View>
              )}
            </>
          ) : null}

          {/* Reassign Button - only for tasks still being worked on */}
          {(task.status === 'pending' || task.status === 'in_progress') && onReassign && mode === 'view' && (
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
  fieldLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: AppTheme.inkSoft,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    borderRadius: 14,
    backgroundColor: AppTheme.soft,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: AppTheme.ink,
  },
  inputMulti: { minHeight: 120, maxHeight: 320, textAlignVertical: 'top' },
  rejectBox: {
    backgroundColor: AppTheme.coralSoft,
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: AppTheme.coral,
    marginBottom: 16,
  },
  rejectText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: AppTheme.ink,
    lineHeight: 21,
  },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, color: AppTheme.coral, marginBottom: 10 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnSoft: { backgroundColor: AppTheme.soft },
  btnSoftText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: AppTheme.ink },
  btnDark: { backgroundColor: AppTheme.charcoal },
  btnDarkText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: AppTheme.white },
  btnApprove: { backgroundColor: AppTheme.green },
  btnReject: { backgroundColor: AppTheme.coral },
  btnRejectSoft: { backgroundColor: AppTheme.coralSoft },
  btnRejectSoftText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: AppTheme.coral },
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
