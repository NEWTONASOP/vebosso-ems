// ============================================================================
// VEBOSSO EMS — Member Tasks Screen (Premium Fintech / Apple Wallet Aesthetic)
// ============================================================================

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Platform, Pressable } from 'react-native';
import { Text, Snackbar } from 'react-native-paper';
import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';
import { TaskCard } from '../../components/TaskCard';
import { ListSkeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { TaskStatus } from '../../types/database';
import { PageTransition } from '../../components/PageTransition';

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

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    try {
      await updateTaskStatus(taskId, status);
      setSnackMessage(status === 'done' ? 'Task completed! ✅' : 'Task updated');
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000000" />}
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

      <Snackbar visible={!!snackMessage} onDismiss={() => setSnackMessage('')} duration={3000}>
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
    backgroundColor: '#EDEDED', // Premium Fintech light grey
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 36,
    paddingBottom: 8,
  },
  title: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 28,
    color: '#1C1C1E',
    letterSpacing: -0.7,
  },
  subtitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 110,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  // Progress Analytics Card
  progressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginTop: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
    elevation: 3,
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
    color: '#8E8E93',
  },
  progressValue: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 16,
    color: '#000000',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#EFEFF4',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#000000', // Premium solid black progress fill
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  filterPillActive: {
    backgroundColor: '#000000', // Active solid black pill
    borderColor: '#000000',
  },
  filterText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: '#8E8E93',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  // List Container
  listContainer: {
    marginTop: 6,
  },
  groupedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
    elevation: 3,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
    elevation: 3,
  },
});
