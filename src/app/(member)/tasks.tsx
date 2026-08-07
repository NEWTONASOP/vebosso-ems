// ============================================================================
// VEBOSSO EMS — Member Tasks Screen
// ============================================================================

import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Snackbar, Text } from 'react-native-paper';
import { EmptyState } from '../../components/EmptyState';
import { ListSkeleton } from '../../components/LoadingSkeleton';
import { PageTransition } from '../../components/PageTransition';
import { TaskCard } from '../../components/TaskCard';
import {
  AppTheme as T,
  AppSpace,
  AppRadius,
  appSoftShadow,
  screenChrome,
} from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';
import { TaskStatus } from '../../types/database';

export default function MemberTasksScreen() {
  const { profile } = useAuthStore();
  const { todayTasks, fetchTodayTasks, updateTaskStatus, isLoadingToday } = useWorkStore();
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');

  useEffect(() => {
    if (profile) fetchTodayTasks(profile.id);
  }, [profile, fetchTodayTasks]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (profile) await fetchTodayTasks(profile.id);
    setRefreshing(false);
  };

  const handleStatusChange = async (taskId: string, status: TaskStatus, completionNote?: string) => {
    try {
      await updateTaskStatus(taskId, status, completionNote);
      setSnackMessage(status === 'done' ? 'Task completed!' : 'Task updated');
    } catch {
      setSnackMessage('Failed to update task');
    }
  };

  const filteredTasks = filter === 'all'
    ? todayTasks
    : todayTasks.filter((t) => t.status === filter);

  const stats = {
    total: todayTasks.length,
    done: todayTasks.filter((t) => t.status === 'done').length,
    inProgress: todayTasks.filter((t) => t.status === 'in_progress').length,
    pending: todayTasks.filter((t) => t.status === 'pending').length,
  };

  const completionPct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  const filterOptions = [
    { key: 'all' as const, label: 'All', count: stats.total },
    { key: 'pending' as const, label: 'Pending', count: stats.pending },
    { key: 'in_progress' as const, label: 'Running', count: stats.inProgress },
    { key: 'done' as const, label: 'Done', count: stats.done },
  ];

  return (
    <PageTransition>
      <View style={screenChrome.root}>
        <View style={screenChrome.header}>
          <Text style={screenChrome.title}>Tasks</Text>
          <Text style={screenChrome.subtitle}>
            {stats.total === 0
              ? 'No assignments yet today'
              : `${stats.done} of ${stats.total} done · ${completionPct}%`}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.charcoal} />
          }
          showsVerticalScrollIndicator={false}
        >
          {stats.total > 0 && (
            <View style={styles.progressCard}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${completionPct}%` }]} />
              </View>
            </View>
          )}

          <View style={styles.filterRow}>
            {filterOptions.map((f) => {
              const isActive = filter === f.key;
              return (
                <Pressable
                  key={f.key}
                  style={[screenChrome.filterChip, isActive && screenChrome.filterChipActive]}
                  onPress={() => setFilter(f.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={`${f.label}, ${f.count} tasks`}
                >
                  <Text
                    style={[
                      screenChrome.filterChipText,
                      isActive && screenChrome.filterChipTextActive,
                    ]}
                  >
                    {f.label}{' '}
                    <Text
                      style={[
                        screenChrome.filterChipCount,
                        isActive && screenChrome.filterChipCountActive,
                      ]}
                    >
                      {f.count}
                    </Text>
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.listContainer}>
            {isLoadingToday ? (
              <ListSkeleton count={3} variant="task-row" />
            ) : filteredTasks.length > 0 ? (
              <View style={styles.tasksList}>
                {filteredTasks.map((task, index) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onStatusChange={handleStatusChange}
                    isLast={index === filteredTasks.length - 1}
                  />
                ))}
              </View>
            ) : (
              <EmptyState
                icon="clipboard-text-outline"
                title={filter === 'all' ? 'No tasks yet' : 'Nothing here'}
                subtitle={
                  filter === 'all'
                    ? 'When your manager assigns work, it will show up here.'
                    : 'Try another filter, or pull down to refresh.'
                }
                actionLabel={filter !== 'all' ? 'Show all tasks' : undefined}
                onAction={filter !== 'all' ? () => setFilter('all') : undefined}
              />
            )}
          </View>
        </ScrollView>

        <Snackbar
          visible={!!snackMessage}
          onDismiss={() => setSnackMessage('')}
          duration={3000}
          wrapperStyle={{ marginBottom: 90 }}
        >
          {snackMessage}
        </Snackbar>
      </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: AppSpace.screen,
    paddingBottom: 110,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  progressCard: {
    backgroundColor: T.card,
    borderRadius: AppRadius.card,
    padding: 16,
    marginTop: 6,
    ...appSoftShadow,
  },
  progressBar: {
    height: 8,
    backgroundColor: T.soft2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: T.charcoal,
    borderRadius: 4,
  },
  filterRow: {
    flexDirection: 'row',
    paddingVertical: 16,
    gap: 8,
    flexWrap: 'wrap',
  },
  listContainer: {
    marginTop: 2,
  },
  tasksList: {
    gap: 10,
  },
});
