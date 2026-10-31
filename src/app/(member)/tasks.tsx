// ============================================================================
// VEBOSSO EMS — Member Tasks Screen
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Snackbar, Text } from 'react-native-paper';
import { AddMyTaskModal } from '../../components/AddMyTaskModal';
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
import { addMyTask, fetchCommentCounts } from '../../lib/selfTasks';
import { useAuthStore } from '../../store/authStore';
import { useShallow } from 'zustand/react/shallow';
import { useWorkStore } from '../../store/workStore';
import { TaskStatus } from '../../types/database';

export default function MemberTasksScreen() {
  const { profile } = useAuthStore(useShallow((s) => ({ profile: s.profile })));
  const { todayTasks, fetchTodayTasks, updateTaskStatus, isLoadingToday } = useWorkStore(useShallow((s) => ({ todayTasks: s.todayTasks, fetchTodayTasks: s.fetchTodayTasks, updateTaskStatus: s.updateTaskStatus, isLoadingToday: s.isLoadingToday })));
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');
  // Given by the boss / manager, or added by the person themselves (072).
  const [tab, setTab] = useState<'boss' | 'mine'>('boss');
  const [adding, setAdding] = useState(false);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (profile) fetchTodayTasks(profile.id);
  }, [profile, fetchTodayTasks]);

  // Little comment badges on the cards; refreshed whenever the list changes.
  const taskIds = todayTasks.map((t) => t.id).join(',');
  useEffect(() => {
    if (!taskIds) return setCommentCounts({});
    let active = true;
    void fetchCommentCounts(taskIds.split(',')).then((c) => active && setCommentCounts(c));
    return () => {
      active = false;
    };
  }, [taskIds, refreshing]);

  const reload = useCallback(() => {
    if (profile) void fetchTodayTasks(profile.id);
  }, [profile, fetchTodayTasks]);

  const handleAdd = async (title: string) => {
    if (!profile) return 'Not signed in';
    const res = await addMyTask(profile.id, profile.full_name, title);
    if (!res.success) return res.error;
    setTab('mine');
    setFilter('all');
    setSnackMessage('Task added — your manager can see it');
    reload();
    return null;
  };

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

  const tabTasks = todayTasks.filter((t) => (tab === 'mine' ? !!t.self_added : !t.self_added));
  const filteredTasks = filter === 'all'
    ? tabTasks
    : tabTasks.filter((t) => t.status === filter);

  const stats = {
    total: tabTasks.length,
    done: tabTasks.filter((t) => t.status === 'done').length,
    inProgress: tabTasks.filter((t) => t.status === 'in_progress').length,
    pending: tabTasks.filter((t) => t.status === 'pending').length,
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
          <Text style={screenChrome.title}>{tab === 'mine' ? 'My Tasks' : 'Tasks by Boss'}</Text>
          <Text style={screenChrome.subtitle}>
            {stats.total === 0
              ? tab === 'mine' ? 'Nothing added yet' : 'No assignments yet today'
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
          <View style={styles.tabs}>
            {([['boss', 'From boss'], ['mine', 'My tasks']] as const).map(([key, label]) => (
              <Pressable
                key={key}
                style={[styles.tab, tab === key && styles.tabActive]}
                onPress={() => {
                  setTab(key);
                  setFilter('all');
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: tab === key }}
              >
                <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>

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
                    commentCount={commentCounts[task.id] || 0}
                    onChanged={reload}
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
                    ? tab === 'mine'
                      ? 'Add what you plan to work on. Your manager and the boss can see it and comment.'
                      : 'When your manager assigns work, it will show up here.'
                    : 'Try another filter, or pull down to refresh.'
                }
                actionLabel={filter !== 'all' ? 'Show all tasks' : undefined}
                onAction={filter !== 'all' ? () => setFilter('all') : undefined}
              />
            )}
          </View>
        </ScrollView>

        {/* Add your own task, from either tab */}
        <Pressable
          style={styles.fab}
          onPress={() => setAdding(true)}
          accessibilityRole="button"
          accessibilityLabel="Add my task"
        >
          <Feather name="plus" size={18} color={T.white} />
          <Text style={styles.fabText}>Add task</Text>
        </Pressable>

        <AddMyTaskModal visible={adding} onDismiss={() => setAdding(false)} onAdd={handleAdd} />

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
  tabs: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    marginTop: 6,
    borderRadius: 999,
    backgroundColor: T.soft2,
  },
  tab: { flex: 1, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: T.card, ...appSoftShadow },
  tabText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.inkSoft },
  tabTextActive: { color: T.ink },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 46,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: T.charcoal,
    ...appSoftShadow,
  },
  fabText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: T.white },
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
