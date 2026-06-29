// ============================================================================
// VEBOSSO EMS — Task Card Component
// ============================================================================

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Chip } from 'react-native-paper';
import { format } from 'date-fns';
import { Colors } from '../constants/colors';
import { Task, TaskStatus } from '../types/database';
import { TASK_STATUS_CONFIG } from '../constants/roles';

interface TaskCardProps {
  task: Task;
  onStatusChange?: (taskId: string, status: TaskStatus) => void;
  showAssignee?: boolean;
}

export function TaskCard({ task, onStatusChange, showAssignee }: TaskCardProps) {
  const statusConfig = TASK_STATUS_CONFIG[task.status];

  const getNextStatus = (): TaskStatus | null => {
    if (task.status === 'pending') return 'in_progress';
    if (task.status === 'in_progress') return 'done';
    return null;
  };

  const nextStatus = getNextStatus();
  const nextLabel = nextStatus === 'in_progress' ? 'Start' : nextStatus === 'done' ? 'Complete' : null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
        <View style={styles.titleContainer}>
          <Text style={[styles.title, task.status === 'done' && styles.titleDone]}>
            {task.title}
          </Text>
          {task.description && (
            <Text style={styles.description} numberOfLines={2}>
              {task.description}
            </Text>
          )}
        </View>
        <Chip
          style={[styles.statusChip, { backgroundColor: statusConfig.backgroundColor }]}
          textStyle={[styles.statusText, { color: statusConfig.color }]}
          compact
        >
          {statusConfig.label}
        </Chip>
      </View>

      <View style={styles.footer}>
        {task.due_date && (
          <Text style={styles.dueDate}>
            📅 {format(new Date(task.due_date), 'MMM dd, yyyy')}
          </Text>
        )}
        <View style={styles.spacer} />
        {nextLabel && onStatusChange && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: TASK_STATUS_CONFIG[nextStatus!].backgroundColor }]}
            onPress={() => onStatusChange(task.id, nextStatus!)}
          >
            <Text style={[styles.actionText, { color: TASK_STATUS_CONFIG[nextStatus!].color }]}>
              {nextLabel}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
    marginRight: 10,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  titleDone: {
    textDecorationLine: 'line-through',
    color: Colors.textTertiary,
  },
  description: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  statusChip: {
    height: 26,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  dueDate: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  spacer: {
    flex: 1,
  },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
