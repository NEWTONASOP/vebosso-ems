// ============================================================================
// VEBOSSO EMS — Member Tasks Screen
// ============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Chip, Snackbar } from 'react-native-paper';
import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';
import { Colors } from '../../constants/colors';
import { TaskCard } from '../../components/TaskCard';
import { ListSkeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { Task, TaskStatus } from '../../types/database';

export default function MemberTasksScreen() {
  const { profile } = useAuthStore();
  const { todayTasks, fetchTodayTasks, updateTaskStatus } = useWorkStore();
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');

  useEffect(() => {
    if (profile) fetchTodayTasks(profile.id);
  }, [profile]);

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

  const renderItem = useCallback(({ item }: { item: Task }) => (
    <TaskCard task={item} onStatusChange={handleStatusChange} />
  ), []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Tasks</Text>
        <Text style={styles.subtitle}>
          {stats.done}/{stats.total} completed
        </Text>
      </View>

      {/* Progress bar */}
      {stats.total > 0 && (
        <View style={styles.progressSection}>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${(stats.done / stats.total) * 100}%` }]}
            />
          </View>
        </View>
      )}

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {(['all', 'pending', 'in_progress', 'done'] as const).map((f) => (
          <Chip
            key={f}
            selected={filter === f}
            onPress={() => setFilter(f)}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            textStyle={[styles.filterChipText, filter === f && styles.filterChipTextActive]}
            compact
          >
            {f === 'all' ? `All (${stats.total})` :
             f === 'pending' ? `Pending (${stats.pending})` :
             f === 'in_progress' ? `In Progress (${stats.inProgress})` :
             `Done (${stats.done})`}
          </Chip>
        ))}
      </View>

      <FlatList
        data={filteredTasks}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
        ListEmptyComponent={
          <EmptyState
            icon="clipboard-text-outline"
            title="No Tasks"
            subtitle={filter === 'all' ? 'No tasks assigned yet. Check back later!' : 'No tasks with this status'}
          />
        }
      />

      <Snackbar visible={!!snackMessage} onDismiss={() => setSnackMessage('')} duration={3000} style={styles.snackbar}>
        {snackMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  progressSection: { paddingHorizontal: 20, paddingTop: 8 },
  progressBar: { height: 6, backgroundColor: Colors.surfaceLighter, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.success, borderRadius: 3 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4, gap: 8, flexWrap: 'wrap' },
  filterChip: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.accentSubtle, borderColor: Colors.accent },
  filterChipText: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600' },
  filterChipTextActive: { color: Colors.accent, fontWeight: '700' },
  list: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
  snackbar: { backgroundColor: Colors.surfaceLight },
});
