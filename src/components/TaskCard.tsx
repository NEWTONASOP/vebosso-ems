// ============================================================================
// VEBOSSO EMS — Task Card Row Component (Fintech Aesthetic)
// ============================================================================

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { AnimatedPressable } from './AnimatedPressable';
import { format } from 'date-fns';

import { Task, TaskStatus } from '../types/database';
import { Feather } from '@expo/vector-icons';

interface TaskCardProps {
  task: Task;
  onStatusChange?: (taskId: string, status: TaskStatus) => void;
  isLast?: boolean;
  index?: number;
}

export function TaskCard({ task, onStatusChange, isLast, index = 0 }: TaskCardProps) {
  const getNextStatus = (): TaskStatus | null => {
    if (task.status === 'pending') return 'in_progress';
    if (task.status === 'in_progress') return 'done';
    return null;
  };

  const nextStatus = getNextStatus();
  const nextLabel = nextStatus === 'in_progress' ? 'Start' : nextStatus === 'done' ? 'Complete' : null;

  const getStatusStyle = () => {
    switch (task.status) {
      case 'done':
        return {
          icon: 'check-circle',
          color: '#34C759', // Green
          bgColor: 'rgba(52, 199, 89, 0.12)',
        };
      case 'in_progress':
        return {
          icon: 'play-circle',
          color: '#007AFF', // Blue
          bgColor: 'rgba(0, 122, 255, 0.12)',
        };
      default:
        return {
          icon: 'circle',
          color: '#8E8E93', // Grey
          bgColor: 'rgba(142, 142, 147, 0.12)',
        };
    }
  };

  const statusStyle = getStatusStyle();

  const handleAction = () => {
    if (onStatusChange && nextStatus) {
      onStatusChange(task.id, nextStatus);
    }
  };

  const getFormattedDate = () => {
    if (!task.due_date) return null;
    try {
      return format(new Date(task.due_date), 'MMM dd');
    } catch {
      return task.due_date;
    }
  };

  const dueDate = getFormattedDate();

  return (
    <Animated.View 
      entering={FadeInDown.delay(index * 50).springify()} 
      layout={LinearTransition.springify()}
      style={styles.rowWrapper}
    >
      <View style={styles.rowContent}>
        {/* Left Status Icon Container */}
        <View style={[styles.iconContainer, { backgroundColor: statusStyle.bgColor }]}>
          <Feather name={statusStyle.icon as any} size={16} color={statusStyle.color} />
        </View>

        {/* Center Text Column */}
        <View style={styles.textContainer}>
          <Text style={[styles.title, task.status === 'done' && styles.titleDone]} numberOfLines={1}>
            {task.title}
          </Text>
          <View style={styles.metaRow}>
            {dueDate && (
              <Text style={styles.metaText}>
                Due {dueDate}
              </Text>
            )}
            {task.description && (
              <Text style={styles.description} numberOfLines={1}>
                {dueDate ? ` • ${task.description}` : task.description}
              </Text>
            )}
          </View>
        </View>

        {/* Right Action Button/Badge */}
        {nextLabel && onStatusChange ? (
          <AnimatedPressable
            style={({ pressed }) => [
              styles.actionBtn,
              nextStatus === 'in_progress' ? styles.startBtn : styles.completeBtn,
              pressed && styles.btnPressed,
            ]}
            onPress={handleAction}
          >
            <Text
              style={[
                styles.actionBtnText,
                nextStatus === 'in_progress' ? styles.startBtnText : styles.completeBtnText,
              ]}
            >
              {nextLabel}
            </Text>
          </AnimatedPressable>
        ) : (
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bgColor }]}>
            <Text style={[styles.statusBadgeText, { color: statusStyle.color }]}>
              {task.status === 'done' ? 'Done' : task.status === 'in_progress' ? 'Running' : 'Pending'}
            </Text>
          </View>
        )}
      </View>
      {!isLast && <View style={styles.separator} />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  rowWrapper: {
    backgroundColor: '#FFFFFF',
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16, // Circular icon container
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  textContainer: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: '#1C1C1E',
  },
  titleDone: {
    textDecorationLine: 'line-through',
    color: '#AEAEB2',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  metaText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: '#8E8E93',
  },
  description: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#AEAEB2',
    flex: 1,
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startBtn: {
    backgroundColor: '#000000', // Solid Black
  },
  startBtnText: {
    color: '#FFFFFF',
  },
  completeBtn: {
    backgroundColor: 'rgba(52, 199, 89, 0.12)', // Soft Green
  },
  completeBtnText: {
    color: '#34C759',
  },
  actionBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    letterSpacing: -0.1,
  },
  btnPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    marginLeft: 62, // 16 (padding) + 32 (icon) + 14 (margin) = 62px inset
  },
});
