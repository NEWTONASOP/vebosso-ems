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
import { VoiceNote } from './VoiceNote';

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

  // One tap to finish: anything not done yet goes straight to the note sheet.
  // Once sent for review it waits for the person who gave it to approve or reject.
  const nextStatus: TaskStatus | null = task.status === 'done' || task.status === 'review' ? null : 'done';
  // An action, not a status — the soft green "Done" pill is kept for finished tasks.
  const nextLabel = nextStatus ? 'Mark done' : null;

  const getStatusStyle = () => {
    switch (task.status) {
      case 'done':
        return {
          icon: 'check-circle',
          color: AppTheme.green,
          bgColor: AppTheme.greenSoft,
        };
      case 'review':
        return {
          icon: 'eye',
          color: AppTheme.violet,
          bgColor: AppTheme.violetSoft,
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
    if (onStatusChange && nextStatus) setShowCompleteModal(true);
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
                <Text style={[styles.title, task.status === 'done' && styles.titleDone]} numberOfLines={2}>
                  {task.title}
                </Text>
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
              {/* Sent back by whoever gave the task: say why, so it can be redone. */}
              {task.rejection_reason && task.status !== 'done' && task.status !== 'review' ? (
                <Text style={styles.rejected} numberOfLines={3}>
                  Please change: {task.rejection_reason}
                </Text>
              ) : null}
              {/* The title and description are cut short here; say so, so it is clear the row opens. */}
              <View style={styles.viewRow}>
                <Text style={styles.viewText}>View full task</Text>
                <Feather name="chevron-right" size={13} color={AppTheme.blue} />
              </View>
            </View>
          </Pressable>

          {/* Right Action Button/Badge */}
          {nextLabel && onStatusChange ? (
            <AnimatedPressable
              scaleTo={0.92}
              style={({ pressed }) => [
                styles.actionBtn,
                styles.completeBtn,
                pressed && styles.btnPressed,
              ]}
              onPress={handleAction}
              accessibilityRole="button"
              accessibilityLabel={`Mark ${task.title} as done`}
            >
              <Feather name="check" size={14} color={AppTheme.white} />
              <Text
                style={[
                  styles.actionBtnText,
                  styles.completeBtnText,
                ]}
              >
                {nextLabel}
              </Text>
            </AnimatedPressable>
          ) : (
            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bgColor }]}>
              <Text style={[styles.statusBadgeText, { color: statusStyle.color }]}>
                {task.status === 'done'
                  ? 'Done'
                  : task.status === 'review'
                    ? 'In review'
                    : task.status === 'in_progress'
                      ? 'Running'
                      : 'Pending'}
              </Text>
            </View>
          )}
        </View>
        {/* Voice note from whoever gave the task, playable right here. */}
        {task.voice_path ? (
          <View style={styles.voiceRow}>
            <VoiceNote path={task.voice_path} durationMs={task.voice_ms} />
          </View>
        ) : null}
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
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completeBtn: {
    backgroundColor: AppTheme.charcoal,
  },
  completeBtnText: {
    color: AppTheme.white,
  },
  actionBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    letterSpacing: -0.1,
  },
  rejected: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12.5,
    color: AppTheme.amber,
    marginTop: 6,
    lineHeight: 18,
  },
  viewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 6,
  },
  viewText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: AppTheme.blue,
  },
  btnPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
  voiceRow: {
    paddingLeft: 62,
    paddingRight: 16,
    paddingBottom: 12,
    marginTop: -4,
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
