// ============================================================================
// VEBOSSO EMS — Work Log Detail Component
// ============================================================================

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Modal, Portal, Text, Chip, Divider, IconButton } from 'react-native-paper';
import { format } from 'date-fns';
import { Colors } from '../constants/colors';
import { Task, WorkLog } from '../types/database';
import { WORK_LOG_STATUS_CONFIG } from '../constants/roles';
import { Feather } from '@expo/vector-icons';

interface WorkLogDetailProps {
  visible: boolean;
  onDismiss: () => void;
  workLog: WorkLog | null;
  tasks?: Task[];
}

const TASK_STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: '#8E8E93', bg: '#F4F4F6', label: 'Pending' },
  in_progress: { color: '#007AFF', bg: 'rgba(0,122,255,0.08)', label: 'In Progress' },
  done: { color: '#34C759', bg: 'rgba(52,199,89,0.08)', label: 'Done' },
};

export function WorkLogDetail({ visible, onDismiss, workLog, tasks = [] }: WorkLogDetailProps) {
  if (!workLog) return null;

  const statusConfig = WORK_LOG_STATUS_CONFIG[workLog.status];

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.container}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View>
              <Text style={styles.dateTitle}>
                {format(new Date(workLog.date), 'EEEE, MMMM dd, yyyy')}
              </Text>
              <Chip
                style={[styles.statusChip, { backgroundColor: statusConfig.backgroundColor }]}
                textStyle={[styles.statusText, { color: statusConfig.color }]}
                compact
              >
                {statusConfig.label}
              </Chip>
            </View>
            <IconButton
              icon="close"
              iconColor={Colors.textSecondary}
              size={22}
              onPress={onDismiss}
            />
          </View>

          <Divider style={styles.divider} />

          {/* Time Summary */}
          <View style={styles.timeRow}>
            <View style={styles.timeCard}>
              <View style={[styles.iconWrapper, { backgroundColor: 'rgba(52, 199, 89, 0.1)' }]}>
                <Feather name="log-in" size={16} color="#34C759" />
              </View>
              <Text style={styles.timeLabel}>Check In</Text>
              <Text style={styles.timeValue}>
                {workLog.check_in_time
                  ? format(new Date(workLog.check_in_time), 'hh:mm a')
                  : '--:--'}
              </Text>
            </View>
            <View style={styles.timeCard}>
              <View style={[styles.iconWrapper, { backgroundColor: 'rgba(255, 59, 48, 0.1)' }]}>
                <Feather name="log-out" size={16} color="#FF3B30" />
              </View>
              <Text style={styles.timeLabel}>Check Out</Text>
              <Text style={styles.timeValue}>
                {workLog.check_out_time
                  ? format(new Date(workLog.check_out_time), 'hh:mm a')
                  : '--:--'}
              </Text>
            </View>
            <View style={styles.timeCard}>
              <View style={[styles.iconWrapper, { backgroundColor: 'rgba(0, 122, 255, 0.1)' }]}>
                <Feather name="clock" size={16} color="#007AFF" />
              </View>
              <Text style={styles.timeLabel}>Total Hours</Text>
              <Text style={styles.timeValue}>
                {workLog.total_hours ? `${workLog.total_hours}h` : '--'}
              </Text>
            </View>
          </View>

          {/* Check-in Plan */}
          {workLog.check_in_plan && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📋 Plan for the Day</Text>
              <View style={styles.sectionContent}>
                <Text style={styles.sectionText}>{workLog.check_in_plan}</Text>
              </View>
            </View>
          )}

          {/* Day Report */}
          {workLog.day_report && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📝 Day Report</Text>
              <View style={styles.sectionContent}>
                <Text style={styles.sectionText}>{workLog.day_report}</Text>
              </View>
            </View>
          )}

          {/* Rejection Reason */}
          {workLog.rejection_reason && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>❌ Rejection Reason</Text>
              <View style={[styles.sectionContent, styles.rejectionContent]}>
                <Text style={styles.sectionText}>{workLog.rejection_reason}</Text>
              </View>
            </View>
          )}

          {/* Tasks */}
          {tasks.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📌 Tasks ({tasks.length})</Text>
              <View style={styles.tasksList}>
                {tasks.map((task) => {
                  const tConfig = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG.pending;
                  return (
                    <View key={task.id} style={styles.taskItem}>
                      <View style={styles.taskHeader}>
                        <View style={[styles.taskStatusDot, { backgroundColor: tConfig.color }]} />
                        <Text style={styles.taskTitle} numberOfLines={2}>{task.title}</Text>
                        <View style={[styles.taskStatusBadge, { backgroundColor: tConfig.bg }]}>
                          <Text style={[styles.taskStatusText, { color: tConfig.color }]}>
                            {tConfig.label}
                          </Text>
                        </View>
                      </View>
                      {task.description ? (
                        <Text style={styles.taskDesc} numberOfLines={2}>{task.description}</Text>
                      ) : null}
                      {task.due_date ? (
                        <View style={styles.taskDueRow}>
                          <Feather name="calendar" size={11} color={Colors.textTertiary} />
                          <Text style={styles.taskDueText}>
                            Due {format(new Date(task.due_date), 'MMM dd')}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </ScrollView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    margin: 16,
    borderRadius: 24,
    padding: 20,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  statusChip: {
    alignSelf: 'flex-start',
    height: 26,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  divider: {
    backgroundColor: Colors.divider,
    marginVertical: 16,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  timeCard: {
    flex: 1,
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  timeLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  timeValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  sectionContent: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 10,
    padding: 14,
  },
  rejectionContent: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.error,
  },
  sectionText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 22,
  },
  // Tasks
  tasksList: {
    gap: 10,
  },
  taskItem: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  taskStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    flexShrink: 0,
  },
  taskTitle: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  taskStatusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  taskStatusText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
  },
  taskDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginLeft: 15,
    marginTop: 2,
    fontFamily: 'Inter_400Regular',
  },
  taskDueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    marginLeft: 15,
  },
  taskDueText: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontFamily: 'Inter_500Medium',
  },
});
