// ============================================================================
// VEBOSSO EMS — Task Card Component
// ============================================================================

import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, Chip, Icon } from 'react-native-paper';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { format } from 'date-fns';
import { Colors } from '../constants/colors';
import { Task, TaskStatus } from '../types/database';
import { TASK_STATUS_CONFIG } from '../constants/roles';

interface TaskCardProps {
  task: Task;
  onStatusChange?: (taskId: string, status: TaskStatus) => void;
  showAssignee?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function TaskCard({ task, onStatusChange, showAssignee }: TaskCardProps) {
  const statusConfig = TASK_STATUS_CONFIG[task.status];
  
  // Animation values
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const getNextStatus = (): TaskStatus | null => {
    if (task.status === 'pending') return 'in_progress';
    if (task.status === 'in_progress') return 'done';
    return null;
  };

  const nextStatus = getNextStatus();
  const nextLabel = nextStatus === 'in_progress' ? 'Start Task' : nextStatus === 'done' ? 'Mark Complete' : null;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 20, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 20, stiffness: 300 });
  };

  const handleAction = () => {
    if (!onStatusChange || !nextStatus) return;
    
    // Quick completion animation
    if (nextStatus === 'done') {
      opacity.value = withTiming(0.5, { duration: 300 });
    }
    
    onStatusChange(task.id, nextStatus);
  };

  return (
    <AnimatedPressable 
      style={[styles.card, animatedStyle]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <View style={styles.titleRow}>
            <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
            <Text style={[styles.title, task.status === 'done' && styles.titleDone]} numberOfLines={1}>
              {task.title}
            </Text>
          </View>
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

      <View style={styles.divider} />

      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          {task.due_date && (
            <View style={styles.dueDateRow}>
              <Icon source="calendar-clock" size={14} color={Colors.textTertiary} />
              <Text style={styles.dueDate}>
                {format(new Date(task.due_date), 'MMM dd')}
              </Text>
            </View>
          )}
        </View>
        
        {nextLabel && onStatusChange && (
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              { backgroundColor: TASK_STATUS_CONFIG[nextStatus!].backgroundColor },
              pressed && { opacity: 0.8 }
            ]}
            onPress={handleAction}
          >
            <Text style={[styles.actionText, { color: TASK_STATUS_CONFIG[nextStatus!].color }]}>
              {nextLabel}
            </Text>
            <Icon 
              source={nextStatus === 'in_progress' ? 'play-circle' : 'check-circle'} 
              size={14} 
              color={TASK_STATUS_CONFIG[nextStatus!].color} 
            />
          </Pressable>
        )}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  titleContainer: {
    flex: 1,
    paddingRight: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    color: Colors.text,
    fontFamily: 'Inter_600SemiBold',
    flex: 1,
  },
  titleDone: {
    textDecorationLine: 'line-through',
    color: Colors.textTertiary,
  },
  description: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
    paddingLeft: 16, // Align with title text past the dot
  },
  statusChip: {
    height: 24,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dueDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dueDate: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: 'Inter_500Medium',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
});

