// ============================================================================
// VEBOSSO EMS — Task Card Row Component (Fintech Aesthetic)
// ============================================================================

import { format } from 'date-fns';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { AnimatedPressable } from './AnimatedPressable';
import { TaskCompleteModal } from './TaskCompleteModal';
import { TaskDetailModal } from './TaskDetailModal';

import { Feather } from '@expo/vector-icons';
import { AppTheme, appSoftShadow } from '../constants/theme';
import { Task, TaskStatus } from '../types/database';

interface TaskCardProps {
  task: Task;
  onStatusChange?: (taskId: string, status: TaskStatus, completionNote?: string) => void;
  isLast?: boolean;
  index?: number;
}

export function TaskCard({ task, onStatusChange, isLast, index = 0 }: TaskCardProps) {
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

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
          color: AppTheme.green,
          bgColor: AppTheme.greenSoft,
        };
      case 'in_progress':
        return {
          icon: 'play-circle',
          color: AppTheme.blue,
          bgColor: AppTheme.blueSoft,
        };
      default:
        return {
          icon: 'circle',
          color: AppTheme.mute,
          bgColor: AppTheme.soft,
        };
    }
  };

  const statusStyle = getStatusStyle();

  const handleAction = () => {
    if (onStatusChange && nextStatus) {
      // If completing the task, show the completion modal
      if (nextStatus === 'done') {
        setShowCompleteModal(true);
      } else {
        // Otherwise, just change status directly
        onStatusChange(task.id, nextStatus);
      }
    }
  };

  const handleComplete = (note: string) => {
    if (onStatusChange) {
      onStatusChange(task.id, 'done', note);
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
    <>
      <Animated.View 
        entering={FadeInDown.delay(index * 50).springify()} 
        layout={LinearTransition.springify()}
        style={styles.rowWrapper}
      >
        <View style={styles.rowContent}>
          <Pressable 
            onPress={() => setShowDetailModal(true)}
            style={({ pressed }) => [
              styles.pressableArea,
              pressed && styles.pressablePressed
            ]}
          >
            {/* Left Status Icon Container */}
            <View style={[styles.iconContainer, { backgroundColor: statusStyle.bgColor }]}>
              <Feather name={statusStyle.icon as any} size={16} color={statusStyle.color} />
            </View>

            {/* Center Text Column */}
            <View style={styles.textContainer}>
              <View style={styles.titleRow}>
                <Text style={[styles.title, task.status === 'done' && styles.titleDone]} numberOfLines={1}>
                  {task.title}
                </Text>
                <Feather name="chevron-right" size={14} color={AppTheme.soft2} />
              </View>
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
          </Pressable>

          {/* Right Action Button/Badge */}
          {nextLabel && onStatusChange ? (
            <AnimatedPressable
              scaleTo={0.92}
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
      </Animated.View>

      {/* Completion Modal */}
      <TaskCompleteModal
        visible={showCompleteModal}
        taskTitle={task.title}
        onDismiss={() => setShowCompleteModal(false)}
        onComplete={handleComplete}
      />

      {/* Detail Modal */}
      <TaskDetailModal
        visible={showDetailModal}
        onDismiss={() => setShowDetailModal(false)}
        task={task as any}
      />
    </>
  );
}

const styles = StyleSheet.create({
  rowWrapper: {
    backgroundColor: AppTheme.card,
    marginVertical: 4,
    marginHorizontal: 2,
    borderRadius: 20,
    ...appSoftShadow,
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 56,
  },
  pressableArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  pressablePressed: {
    opacity: 0.7,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  textContainer: {
    flex: 1,
    paddingRight: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: AppTheme.ink,
    flex: 1,
  },
  titleDone: {
    textDecorationLine: 'line-through',
    color: AppTheme.mute,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  metaText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: AppTheme.mute,
  },
  description: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: AppTheme.mute,
    flex: 1,
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startBtn: {
    backgroundColor: AppTheme.charcoal,
  },
  startBtnText: {
    color: AppTheme.white,
  },
  completeBtn: {
    backgroundColor: AppTheme.greenSoft,
    borderRadius: 14,
  },
  completeBtnText: {
    color: AppTheme.green,
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
    borderRadius: 10,
  },
  statusBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
});
