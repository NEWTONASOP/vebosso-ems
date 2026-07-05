// ============================================================================
// VEBOSSO EMS — Member Tasks Screen (Premium Fintech / Apple Wallet Aesthetic)
// ============================================================================

import { useEffect, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Snackbar, Text } from 'react-native-paper';
import { EmptyState } from '../../components/EmptyState';
import { ListSkeleton } from '../../components/LoadingSkeleton';
import { PageTransition } from '../../components/PageTransition';
import { TaskCard } from '../../components/TaskCard';
import { Colors } from '../../constants/colors';
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

  return (
    <PageTransition>
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tasks</Text>
        <Text style={styles.subtitle}>
          {stats.done}/{stats.total} completed today
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress Analytics Card */}
        {stats.total > 0 && (
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Completion Rate</Text>
              <Text style={styles.progressValue}>
                {Math.round((stats.done / stats.total) * 100)}%
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${(stats.done / stats.total) * 100}%` }]}
              />
            </View>
          </View>
        )}

        {/* Filter segment pills */}
        <View style={styles.filterRow}>
          {(['all', 'pending', 'in_progress', 'done'] as const).map((f) => {
            const isActive = filter === f;
            const count = f === 'all' ? stats.total : f === 'pending' ? stats.pending : f === 'in_progress' ? stats.inProgress : stats.done;
            const label = f === 'all' ? 'All' : f === 'pending' ? 'Pending' : f === 'in_progress' ? 'Running' : 'Done';
            return (
              <Pressable
                key={f}
                style={[styles.filterPill, isActive && styles.filterPillActive]}
                onPress={() => setFilter(f)}
              >
                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                  {label} ({count})
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Tasks unified Grouped Card */}
        <View style={styles.listContainer}>
          {isLoadingToday ? (
            <ListSkeleton count={3} />
          ) : filteredTasks.length > 0 ? (
            <View style={styles.groupedCard}>
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
            <View style={styles.emptyCard}>
              <EmptyState
                icon="clipboard-text-outline"
                title="No Tasks Found"
                subtitle={filter === 'all' ? 'No tasks assigned yet.' : 'No tasks in this category'}
              />
            </View>
          )}
        </View>
      </ScrollView>

      <Snackbar visible={!!snackMessage} onDismiss={() => setSnackMessage('')} duration={3000} wrapperStyle={{ marginBottom: 90 }}>
        {snackMessage}
      </Snackbar>
    </View>
    </PageTransition>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: 8,
  },
  title: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 28,
    color: Colors.textPrimary,
    letterSpacing: -0.7,
  },
  subtitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  // Progress Analytics Card
  progressCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 20,
    marginTop: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.textSecondary,
  },
  progressValue: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 16,
    color: Colors.textPrimary,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.surfaceLighter,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.memberAccent,
    borderRadius: 4,
    width: 0, // Fallback width overwritten dynamically
  },
  // Filter row
  filterRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    gap: 8,
    flexWrap: 'wrap',
    paddingHorizontal: 4,
  },
  filterPill: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  filterPillActive: {
    backgroundColor: Colors.memberAccent,
    borderColor: Colors.memberAccent,
  },
  filterText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: Colors.textSecondary,
  },
  filterTextActive: {
    color: Colors.white,
  },
  // List Container
  listContainer: {
    marginTop: 6,
  },
  groupedCard: {
    paddingTop: 2,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
});
